/** Shared runtime context for all GUI modules. */
let _ctx = null;

/** Stores the active GUI state object. */
export function initContext(state) {
    _ctx = state;
}

/** Returns the active GUI state. */
export function getContext() {
    if(!_ctx) throw new Error('GUI context not initialised');
    return _ctx;
}
