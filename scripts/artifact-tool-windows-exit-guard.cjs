// Temporary QA guard for the bundled Windows renderer: its Chromium host can
// crash during natural process teardown after all PNGs have been written.
// Keeping Node alive briefly lets the caller receive the completed JSON result,
// then exits cleanly. This file is removed after presentation QA.
setTimeout(() => process.reallyExit(0), 35_000);
