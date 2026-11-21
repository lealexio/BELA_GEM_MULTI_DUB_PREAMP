#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root of the workspace (two levels up from .agents/skills/bela-dev-deploy/scripts/)
const workspaceRoot = path.resolve(__dirname, '../../../../');
const srcDir = path.join(workspaceRoot, 'src');
const guiDir = path.join(workspaceRoot, 'gui');
const sketchJsPath = path.join(srcDir, 'sketch.js');

const BELA_HOST = process.env.BELA_HOST || 'bela.local';
const BELA_USER = process.env.BELA_USER || 'root';
const BELA_WS_PORT = 3000;

// CLI arguments
const argv = process.argv.slice(2);
const isStopOnly = argv.includes('--stop');
const isBuildOnly = argv.includes('--build-only');
const isForce = argv.includes('--force') || argv.includes('-f');
const skipGui = argv.includes('--skip-gui');
const outputJson = argv.includes('--json');

const projectArg = argv.find(a => a.startsWith('--project='));
const explicitProject = projectArg ? projectArg.split('=')[1].trim() : process.env.BELA_PROJECT;

async function main() {
  logHeader();

  if (isStopOnly) {
    await stopRunningProject();
    process.exit(0);
  }

  // 1. Resolve Project Name
  const projectName = await resolveProjectName();
  const remoteDir = `/root/Bela/projects/${projectName}`;
  logInfo(`Target project: ${projectName} (${remoteDir})`);

  // 2. Build Web GUI if needed
  if(!skipGui && fs.existsSync(guiDir)) {
        const guiNeedsRebuild = isForce || shouldRebuildGui();
        if (guiNeedsRebuild) {
          logInfo('Building Web GUI bundle (gui/ -> src/sketch.js)...');
          const guiRes = spawnSync(process.execPath, ['scripts/build-gui.mjs'], {
            cwd: workspaceRoot,
            stdio: 'inherit',
          });
          if (guiRes.status !== 0) {
            failWithDiagnostic({
              status: 'error',
              stage: 'gui_build',
              message: 'GUI build script failed.',
              errors: [{ file: 'scripts/build-gui.mjs', message: 'esbuild bundling failed' }]
            });
          }
        } else {
          logInfo('Web GUI bundle is up-to-date. Skipping esbuild.');
        }
      }

      // 3. Upload modified source files
      logInfo(isForce ? 'Synchronizing ALL files to Bela (--force)...' : 'Checking for modified files (delta-sync)...');
      await uploadFiles(projectName, remoteDir);

      // 4. Build & Run on Bela
      logInfo('Triggering build & run on Bela via WebSocket...');
      await executeBuildAndRun(projectName);
    }

    function shouldRebuildGui() {
      if (!fs.existsSync(sketchJsPath)) return true;
      const sketchMtime = fs.statSync(sketchJsPath).mtimeMs;

      function checkDir(dir) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const full = path.join(dir, item.name);
          if (item.isDirectory()) {
            if (checkDir(full)) return true;
          } else if (item.isFile()) {
            if (fs.statSync(full).mtimeMs > sketchMtime) return true;
          }
        }
        return false;
      }

      return checkDir(guiDir);
    }

    function logHeader() {
      if (outputJson) return;
      console.log(`\n======================================================`);
      console.log(`🎛️  Bela Dev Deploy & Auto-Diagnostic (Incremental)`);
      console.log(`======================================================`);
    }

    function logInfo(msg) {
      if (outputJson) return;
      console.log(`[BelaDeploy] ${msg}`);
    }

    async function resolveProjectName() {
      if (explicitProject) return explicitProject;

      // Try querying current active project from Bela settings.json
      try {
        const res = spawnSync('ssh', [
          '-o', 'BatchMode=yes',
          '-o', 'ConnectTimeout=3',
          `${BELA_USER}@${BELA_HOST}`,
          'cat /root/Bela/settings.json 2>/dev/null'
        ], { encoding: 'utf8' });

        if (res.status === 0 && res.stdout) {
          const parsed = JSON.parse(res.stdout);
          if (parsed.project && typeof parsed.project === 'string') {
            return parsed.project;
          }
        }
      } catch (e) {
        // ignore, fall back to directory name
      }

      // Fallback to directory name
      return path.basename(workspaceRoot);
    }

    function getRemoteChecksums(remoteDir) {
      try {
        const res = spawnSync('ssh', [
          '-o', 'BatchMode=yes',
          '-o', 'ConnectTimeout=5',
          `${BELA_USER}@${BELA_HOST}`,
          `find "${remoteDir}/" -maxdepth 1 -type f -exec md5sum {} + 2>/dev/null`
        ], { encoding: 'utf8' });

        if (res.stdout) {
          const map = new Map();
          for (const line of res.stdout.split('\n')) {
            const trimmed = line.trim();
            const match = trimmed.match(/^([a-f0-9]{32})\s+(.+)$/);
            if (match) {
              const hash = match[1];
              const fullPath = match[2];
              const basename = path.basename(fullPath);
              map.set(basename, hash);
            }
          }
          return map;
        }
      } catch (e) { }
      return new Map();
    }

    function getFileMd5(filePath) {
      try {
        const data = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(data).digest('hex');
      } catch (e) {
        return null;
      }
    }

    async function uploadFiles(projectName, remoteDir) {
      if (!fs.existsSync(srcDir)) {
        failWithDiagnostic({
          status: 'error',
          stage: 'upload',
          message: `Source directory does not exist: ${srcDir}`,
          errors: []
        });
      }

      // Ensure remote directory exists
      const mkdir = spawnSync('ssh', [
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=5',
        `${BELA_USER}@${BELA_HOST}`,
        `mkdir -p "${remoteDir}"`
      ]);

      if (mkdir.status !== 0) {
        failWithDiagnostic({
          status: 'error',
          stage: 'ssh_connect',
          message: `Failed to connect to ${BELA_USER}@${BELA_HOST} via SSH. Check if board is powered on.`,
          errors: []
        });
      }

      const entries = fs.readdirSync(srcDir);
      let filesToCopy = [];

      if (isForce) {
        filesToCopy = entries.map(name => path.join('src', name));
        logInfo(`Force mode enabled: transferring all ${filesToCopy.length} files...`);
      } else {
        const remoteChecksums = getRemoteChecksums(remoteDir);
        for (const name of entries) {
          const localPath = path.join(srcDir, name);
          const stat = fs.statSync(localPath);

          if (stat.isFile()) {
            const localHash = getFileMd5(localPath);
            const remoteHash = remoteChecksums.get(name);
            if (!remoteHash || localHash !== remoteHash) {
              filesToCopy.push(path.join('src', name));
            }
          } else if (stat.isDirectory()) {
            // For directories (e.g. samples/), always copy or check
            filesToCopy.push(path.join('src', name));
          }
        }
      }

      if (filesToCopy.length === 0) {
        logInfo(`⚡ All ${entries.length} files are up-to-date on Bela (0 modified). Skipping upload.`);
        return;
      }

      logInfo(`🚀 Uploading ${filesToCopy.length} modified file(s): ${filesToCopy.map(f => path.basename(f)).join(', ')}...`);

      const scp = spawnSync('scp', [
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=10',
        '-r',
        ...filesToCopy,
        `${BELA_USER}@${BELA_HOST}:${remoteDir}/`
      ], {
        cwd: workspaceRoot,
        stdio: outputJson ? 'ignore' : 'inherit',
      });

      if (scp.status !== 0) {
        failWithDiagnostic({
          status: 'error',
          stage: 'scp_upload',
          message: `SCP failed with exit code ${scp.status}`,
          errors: []
        });
      }

      logInfo(`✅ Transferred ${filesToCopy.length} modified file(s) to ${remoteDir}`);
    }

    async function stopRunningProject() {
      logInfo('Stopping running project on Bela...');
      return new Promise((resolve) => {
        let ws;
        try {
          ws = new WebSocket(`ws://${BELA_HOST}:${BELA_WS_PORT}`);
        } catch (err) {
          console.error('Failed to open WebSocket:', err.message);
          return resolve();
        }

        const timer = setTimeout(() => {
          ws.close();
          resolve();
        }, 4000);

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'stopBuild',
            payload: {},
            uuid: 'stop-' + Date.now()
          }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'buildAndRunStatusChangeNotification' && msg.payload?.status === 'stopped') {
              logInfo('Bela project successfully stopped.');
              clearTimeout(timer);
              ws.close();
              resolve();
            }
          } catch (e) { }
        };

        ws.onerror = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }

    async function executeBuildAndRun(projectName) {
      return new Promise((resolve) => {
        let ws;
        try {
          ws = new WebSocket(`ws://${BELA_HOST}:${BELA_WS_PORT}`);
        } catch (err) {
          failWithDiagnostic({
            status: 'error',
            stage: 'websocket_connect',
            message: `Failed to connect to Bela WebSocket: ${err.message}`,
            errors: []
          });
        }

        const connectTimeout = setTimeout(() => {
          ws.close();
          failWithDiagnostic({
            status: 'error',
            stage: 'websocket_timeout',
            message: `Timeout connecting to ws://${BELA_HOST}:${BELA_WS_PORT}`,
            errors: []
          });
        }, 8000);

        let stage = 'init';
        let fullStderr = '';
        let fullStdout = '';
        let runtimeLogs = '';
        let hasStartedCurrentAllStage = false;
        let hasCompletedAllStage = false;
        let hasStartedRunning = false;

        ws.onopen = () => {
          clearTimeout(connectTimeout);
          logInfo('Connected to Bela IDE WebSocket, sending buildAndRun command...');
          ws.send(JSON.stringify({
            type: 'buildAndRun',
            payload: { projectId: projectName },
            uuid: 'build-' + Date.now()
          }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'buildAndRunStatusChangeNotification') {
              const payload = msg.payload || {};
              stage = payload.stage;
              const status = payload.status;
              const info = payload.info || '';

              // Ignore cancellation/SIGINT from a previously running process being stopped
              if (info.includes('signal SIGINT') || info.includes('Process stopped')) {
                return;
              }

              if (stage === 'all') {
                if (status === 'started') {
                  hasStartedCurrentAllStage = true;
                  logInfo('Native ARM compilation started (Clang++)...');
                } else if (status === 'stdout') {
                  fullStdout += info;
                  if (!outputJson) process.stdout.write(info);
                } else if (status === 'stderr') {
                  fullStderr += info;
                  if (!outputJson) process.stderr.write(info);
                } else if (status === 'completed') {
                  hasCompletedAllStage = true;
                  logInfo('Compilation succeeded!');
                  if (isBuildOnly) {
                    ws.close();
                    finishSuccess({ stage: 'all', message: 'Build completed successfully.' });
                  }
                } else if (status === 'error') {
                  // Only fail if this error is from the active build
                  if (hasStartedCurrentAllStage) {
                    ws.close();
                    const parsedErrors = parseClangDiagnostics(fullStderr + '\n' + info, projectName);
                    failWithDiagnostic({
                      status: 'error',
                      stage: 'compilation',
                      message: 'Compilation failed on Bela.',
                      errorCount: parsedErrors.length,
                      errors: parsedErrors,
                      rawOutput: info || fullStderr
                    });
                  }
                }
              } else if (stage === 'runide') {
                // Ignore previous runide messages (e.g. previous instance stopping before compilation)
                if (!hasCompletedAllStage) {
                  return;
                }

                if (status === 'stdout' || status === 'started') {
                  runtimeLogs += info;
                  if (!hasStartedRunning) {
                    hasStartedRunning = true;
                    logInfo('Bela audio program is now RUNNING on Xenomai/EVL!');
                    if (!outputJson) {
                      console.log(`\n--- Runtime Output ---`);
                      process.stdout.write(info);
                    }
                    // Wait 3 seconds to ensure clean startup without crash
                    setTimeout(() => {
                      ws.close();
                      finishSuccess({
                        stage: 'runide',
                        message: 'Project built and audio engine is running successfully.',
                        runtimeLogs: runtimeLogs.trim()
                      });
                    }, 3000);
                  } else {
                    if (!outputJson) process.stdout.write(info);
                  }
                } else if (status === 'stderr') {
                  runtimeLogs += info;
                  if (!outputJson) process.stderr.write(info);
                } else if (status === 'error') {
                  ws.close();
                  failWithDiagnostic({
                    status: 'error',
                    stage: 'runtime_startup',
                    message: 'Program crashed or failed to start.',
                    errors: [{ message: info.trim() }],
                    rawOutput: runtimeLogs
                  });
                }
              }
            }
          } catch (err) {
            // ignore JSON parse errors from non-protocol frames
          }
        };

        ws.onerror = (err) => {
          clearTimeout(connectTimeout);
          failWithDiagnostic({
            status: 'error',
            stage: 'websocket',
            message: `WebSocket error: ${err.message}`,
            errors: []
          });
        };
      });
    }

    function parseClangDiagnostics(rawText, projectName) {
      const errors = [];
      const lines = rawText.split('\n');

      // Match pattern: /root/Bela/projects/<project>/<file>:<line>:<col>: error: <message>
      // or relative: <file>:<line>:<col>: error: <message>
      const diagRegex = /(?:.*\/projects\/[^/]+\/)?([a-zA-Z0-9_.-]+\.(?:cpp|h|c|hpp)):(\d+):(\d+):\s+(fatal error|error):\s+(.+)/;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(diagRegex);
        if (match) {
          const fileName = match[1];
          const lineNum = parseInt(match[2], 10);
          const colNum = parseInt(match[3], 10);
          const severity = match[4];
          const message = match[5];

          // Context line (if next line contains code snippet)
          let context = '';
          if (i + 1 < lines.length && !lines[i + 1].includes(': error:')) {
            context = lines[i + 1].trim();
          }

          errors.push({
            file: `src/${fileName}`,
            line: lineNum,
            column: colNum,
            severity,
            message,
            context
          });
        }
      }

      return errors;
    }

    function failWithDiagnostic(diag) {
      if (outputJson) {
        console.log(JSON.stringify(diag, null, 2));
      } else {
        console.error(`\n❌ [DEPLOY & BUILD FAILED]`);
        console.error(`Stage:   ${diag.stage}`);
        console.error(`Message: ${diag.message}`);
        if (diag.errors && diag.errors.length > 0) {
          console.error(`\nFound ${diag.errors.length} actionable diagnostic(s):`);
          for (const err of diag.errors) {
            console.error(`  📍 ${err.file}:${err.line}:${err.column} -> [${err.severity || 'error'}] ${err.message}`);
            if (err.context) {
              console.error(`     > ${err.context}`);
            }
          }
        } else if (diag.rawOutput) {
          console.error(`\nRaw details:\n${diag.rawOutput.trim()}`);
        }
        console.error(`\n👉 The developer agent should inspect the failing file(s), correct the code, and re-run deployment.`);
      }
      process.exit(1);
    }

    function finishSuccess(info) {
      if (outputJson) {
        console.log(JSON.stringify({ status: 'success', ...info }, null, 2));
      } else {
        console.log(`\n======================================================`);
        console.log(`✅ [DEPLOY & BUILD SUCCEEDED]`);
        console.log(`Status:  ${info.message}`);
        console.log(`GUI URL: http://${BELA_HOST}/gui/`);
        console.log(`IDE URL: http://${BELA_HOST}/`);
        console.log(`======================================================\n`);
      }
      process.exit(0);
    }

    main().catch(err => {
      failWithDiagnostic({
        status: 'error',
        stage: 'fatal',
        message: err.message,
        errors: []
      });
    });
