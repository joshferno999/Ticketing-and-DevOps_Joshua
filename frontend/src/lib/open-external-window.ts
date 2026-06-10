export type ExternalWindowController = {
  blocked: boolean;
  close: () => void;
  navigate: (url: string) => boolean;
  windowRef: Window | null;
};

export function openExternalWindow() {
  const popup = window.open("", "_blank", "popup=yes,width=1280,height=900");

  if (!popup) {
    return {
      blocked: true,
      close: () => undefined,
      navigate: () => false,
      windowRef: null
    } satisfies ExternalWindowController;
  }

  popup.document.write(
    "<!doctype html><title>Connecting...</title><body style=\"font-family: Geist, Inter, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; color:oklch(23% 0.018 245); background:oklch(98% 0.006 245);\">Connecting…</body>"
  );
  popup.document.close();

  return {
    blocked: false,
    close: () => popup.close(),
    navigate: (url: string) => {
      popup.location.replace(url);
      popup.focus();
      return true;
    },
    windowRef: popup
  } satisfies ExternalWindowController;
}
