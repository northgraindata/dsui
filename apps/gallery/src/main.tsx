/**
 * One origin serves two things. `/` is the gallery. Every other path, and `/`
 * with `?shell=1`, is the real web application running on fixture data.
 */
const isShell =
  location.pathname !== "/" ||
  new URLSearchParams(location.search).has("shell");

if (isShell) void import("./shell/main").then((shell) => shell.startShell());
else void import("./gallery-main").then((gallery) => gallery.startGallery());
