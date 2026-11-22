export const TOUR_STORAGE_KEY = "payloop.tour.done";

/**
 * Determines whether the onboarding tour should automatically open.
 * Returns false if the tour has already been completed/skipped or
 * if the user is visiting a direct payment route (/pay/*) where a client
 * only wants to pay their invoice without seeing freelancer onboarding.
 */
export function shouldAutoOpenTour(
  pathname: string | null | undefined,
  hasSeenTour: boolean
): boolean {
  if (hasSeenTour) return false;
  if (!pathname) return true;
  if (pathname === "/pay" || pathname.startsWith("/pay/")) {
    return false;
  }
  return true;
}
