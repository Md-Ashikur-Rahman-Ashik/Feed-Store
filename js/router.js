/**
 * router.js — Hash-based client-side router.
 *
 * No library. No dependencies. Just window.onhashchange.
 *
 * Special behavior:
 *   #login route → replaces entire #app innerHTML (no shell)
 *   All other routes → replaces only #view-mount innerHTML (shell stays)
 */

const routes = {};
let currentRoute = null;
let mountPoint = null;
let guardFn = null;

export function registerRoute(hash, handler) {
  routes[hash] = handler;
}

export function navigate(hash) {
  window.location.hash = "#" + hash;
}

export function getCurrentRoute() {
  return window.location.hash.replace("#", "") || "dashboard";
}

/** After login, call this to point the router at the new #view-mount inside the shell. */
export function setMountPoint(el) {
  mountPoint = el;
}

/**
 * Initialize the router.
 * @param {HTMLElement} initialMount — #app on first load (login), or #view-mount (if already logged in)
 * @param {Function} guard — returns true if user is authenticated
 */
export function initRouter(initialMount, guard) {
  mountPoint = initialMount;
  guardFn = guard;

  async function handleRoute() {
    const hash = getCurrentRoute();

    // LOGIN ROUTE: full page replacement, no shell
    if (hash === "login") {
      if (guardFn && guardFn()) {
        // Already logged in but on #login — redirect to dashboard
        navigate("dashboard");
        return;
      }
      currentRoute = hash;
      const handler = routes["login"];
      if (handler) {
        document.getElementById("app").innerHTML = "";
        await handler(document.getElementById("app"));
      }
      return;
    }

    // AUTH GUARD: not logged in, redirect to login
    if (guardFn && !guardFn()) {
      navigate("login");
      return;
    }

    // SAME ROUTE: skip re-render
    if (hash === currentRoute) return;
    currentRoute = hash;

    // NORMAL ROUTE: render into view-mount only
    const handler = routes[hash];
    if (handler) {
      mountPoint.innerHTML = "";
      await handler(mountPoint);
      if (window.lucide) lucide.createIcons();
    } else {
      navigate("dashboard");
    }
  }

  window.addEventListener("hashchange", handleRoute);

  // Initial route
  if (!window.location.hash) {
    navigate(guardFn && guardFn() ? "dashboard" : "login");
  } else {
    handleRoute();
  }
}
