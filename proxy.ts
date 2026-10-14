import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

// Receipts and the explainer page are public. Everything else needs a
// signed in trader (a guest demo account counts). Signed-out visitors to `/`
// get the landing page instead of the app home, at the same URL.
const isPublic = createRouteMatcher(["/signin", "/r/(.*)", "/how-it-works"]);
const isSignIn = createRouteMatcher(["/signin"]);

export const proxy = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const signedIn = await convexAuth.isAuthenticated();
  if (request.nextUrl.pathname === "/" && !signedIn) {
    return NextResponse.rewrite(new URL("/welcome", request.url));
  }
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
