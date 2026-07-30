/**
 * router.js — Hash-based client-side router.
 *
 * No library. No dependencies. Just window.onhashchange.
 *
 * Special behavior:
 *   #login route → replaces entire #app innerHTML (no shell)
 *   All other routes → replaces only #view-mount innerHTML (shell stays)
 */

import { cleanupViewScopes } from "./views/viewHelpers.js";

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

    // Run previous cleanup before any route switch (defensive — ensures listeners are
    // removed even when navigating to #login, which has an early return below)
    cleanupViewScopes();

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

    // SAME ROUTE: re-render to re-register listeners after cleanup
    // (don't bail out early — cleanup already ran above, the handler must be called
    //  again so views can register fresh AbortController listeners)
    currentRoute = hash;

    // NORMAL ROUTE: render into view-mount only
    // Strip query params to find the base route handler (e.g., "customer-ledger?id=5" → "customer-ledger")
    const baseRoute = hash.split("?")[0];
    const handler = routes[baseRoute];
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
