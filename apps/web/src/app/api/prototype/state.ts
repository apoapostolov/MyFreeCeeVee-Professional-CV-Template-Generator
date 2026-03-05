export type PrototypeRuntimeState = "stopped" | "running";

export type PrototypeService = {
  id: string;
  label: string;
  status: "ready" | "stopped";
  note: string;
};

export type PrototypeStatus = {
  state: PrototypeRuntimeState;
  updatedAt: string;
  services: PrototypeService[];
};

let currentState: PrototypeRuntimeState = "stopped";
let updatedAt = new Date().toISOString();

const BASE_SERVICES: ReadonlyArray<Omit<PrototypeService, "status">> = [
  {
    id: "web",
    label: "Web App",
    note: "Next.js UI for prototype interaction",
  },
  {
    id: "parser",
    label: "Parser",
    note: "PDF/Image decomposition placeholder",
  },
  {
    id: "export",
    label: "Export Engine",
    note: "Template -> PDF placeholder",
  },
  {
    id: "ai-template",
    label: "AI Template Extractor",
    note: "Source adaptation and slot mapping placeholder",
  },
];

function materializeServices(
  state: PrototypeRuntimeState,
): PrototypeStatus["services"] {
  return BASE_SERVICES.map((service) => ({
    ...service,
    status: state === "running" ? "ready" : service.id === "web" ? "ready" : "stopped",
  }));
}

export function getPrototypeStatus(): PrototypeStatus {
  return {
    state: currentState,
    updatedAt,
    services: materializeServices(currentState),
  };
}

export function setPrototypeState(state: PrototypeRuntimeState): PrototypeStatus {
  currentState = state;
  updatedAt = new Date().toISOString();
  return getPrototypeStatus();
}
