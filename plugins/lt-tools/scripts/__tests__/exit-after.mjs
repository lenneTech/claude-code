// exit-after.mjs — the outer timeout of a test file.
//
// A test's own timeout ends the test, not the work it started: a browser process or a socket
// that outlives the test keeps the file's process alive, and `node --test` waits for that
// process without end. Observed 2026-11-07 (Plugin CI run 42397928214, attempt 1,
// windows-latest): once the lt-tools tests started, nothing was printed for 17.5 minutes until
// the job hit its 20-minute timeout. The timer is unref'd,
// so it never keeps a finished file alive on its own; it fires only when something else does,
// and then the file fails visibly instead of stalling the run.

/** Ends this process with code 1 when it is still running `ms` after the call. */
export function exitAfter(ms, label) {
  const timer = setTimeout(() => {
    process.stderr.write(
      `${label}: still running after ${Math.round(ms / 1000)} s; an open handle keeps the process alive, exiting with code 1\n`,
    );
    process.exit(1);
  }, ms);
  timer.unref();
  return timer;
}
