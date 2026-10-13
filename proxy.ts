import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Receipts and the explainer page are public. Everything else needs a
// signed in trader (a guest demo account counts).
const isPublic = createRouteMatcher(["/signin", "/r/(.*)", "/how-it-works"]);
const isSignIn = createRouteMatcher(["/signin"]);

export const proxy = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const signedIn = await convexAuth.isAuthenticated();
  if (isSignIn(request) && signedIn) {
    return nextjsMiddlewareRedirect(request, "/");
  }
  if (!isPublic(request) && !signedIn) {
    return nextjsMiddlewareRedirect(request, "/signin");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
