export interface PortalLink {
  id: string;
  label: string;
  url: string;
}

export interface PortalConfig {
  welcomeTitle: string;
  welcomeMessage: string;
  links: PortalLink[];
  workflowStages: string[];
}

export interface PublicOrderProgress {
  invoiceNumber: string;
  currentStage: number;
  workflowStages: string[];
}

export const defaultPortalConfig: PortalConfig = {
  welcomeTitle: "Selamat datang",
  welcomeMessage: "Temukan toko dan layanan kami melalui tautan berikut.",
  links: [],
  workflowStages: ["Order masuk", "Diproses", "Produksi", "Selesai"],
};

export function normalizePortalConfig(value: unknown): PortalConfig {
  if (!value || typeof value !== "object") return defaultPortalConfig;
  const raw = value as Partial<PortalConfig>;
  const links = Array.isArray(raw.links)
    ? raw.links
        .filter(
          (link): link is PortalLink =>
            Boolean(link) &&
            typeof link.id === "string" &&
            typeof link.label === "string" &&
            typeof link.url === "string",
        )
        .map((link) => {
          let url = "";
          try {
            const parsed = new URL(link.url.trim());
            if (parsed.protocol === "https:" || parsed.protocol === "http:") {
              url = parsed.toString();
            }
          } catch {
            url = "";
          }
          return {
            id: link.id.slice(0, 80),
            label: link.label.trim().slice(0, 60),
            url,
          };
        })
        .filter((link) => link.label && link.url)
        .slice(0, 20)
    : [];
  const workflowStages = Array.isArray(raw.workflowStages)
    ? [...new Set(raw.workflowStages
        .filter((stage): stage is string => typeof stage === "string")
        .map((stage) => stage.trim().slice(0, 40))
        .filter(Boolean))]
        .slice(0, 12)
    : [];

  const savedWelcomeTitle =
    typeof raw.welcomeTitle === "string" ? raw.welcomeTitle.trim() : "";
  const savedWelcomeMessage =
    typeof raw.welcomeMessage === "string" ? raw.welcomeMessage.trim() : "";

  return {
    welcomeTitle:
      savedWelcomeTitle
        ? savedWelcomeTitle.slice(0, 80)
        : defaultPortalConfig.welcomeTitle,
    welcomeMessage: savedWelcomeMessage
      ? savedWelcomeMessage.slice(0, 240)
      : defaultPortalConfig.welcomeMessage,
    links,
    workflowStages:
      workflowStages.length > 0
        ? workflowStages
        : defaultPortalConfig.workflowStages,
  };
}

export function remapProductionStage(
  stage: number,
  previousStages: string[],
  nextStages: string[],
): number {
  const previousStage = Math.max(0, Math.min(Math.floor(stage), previousStages.length));
  if (previousStage === previousStages.length) return nextStages.length;
  const matchingStage = nextStages.indexOf(previousStages[previousStage]);
  if (matchingStage >= 0) return matchingStage;
  if (nextStages.length < previousStages.length) {
    return Math.max(0, Math.min(previousStage - 1, nextStages.length - 1));
  }
  return Math.min(previousStage, nextStages.length - 1);
}
