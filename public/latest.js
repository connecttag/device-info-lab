// Commit only the latest request's response, including after a slow failure.
export function latestLoader(load, commit) {
    let version = 0;
    return async (...args) => {
        const current = ++version;
        try {
            const data = await load(...args);
            if (current !== version) return;
            commit(data); return data;
        } catch (error) { if (current === version) throw error; }
    };
}
