const STORAGE_KEY = "emergence.onboarding.appAccess";

export function grantOnboardingAppAccess() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(STORAGE_KEY, "granted");
}

export function hasOnboardingAppAccess() {
  if (typeof window === "undefined") {
    return false;
  }

  return sessionStorage.getItem(STORAGE_KEY) === "granted";
}

export function clearOnboardingAppAccess() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(STORAGE_KEY);
}
