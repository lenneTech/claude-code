// exit-after.mjs — the outer timeout of a test file.
//
// A test's own timeout ends the test, not the work it started: a browser process or a socket
// that outlives the test keeps the file's process alive, and `node --test` waits for that
// process without end. Observed 2026-11-07 (Plugin CI run 42397928214, windows-latest): the
// lt-tools tests printed nothing for 19 minutes until the job timeout. The timer is unref'd,
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
