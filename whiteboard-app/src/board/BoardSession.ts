import type { BoardPersistence } from "../persistence/BoardPersistence";
import type { BoardState } from "./BoardState";

export interface BoardCanvas {
  display(state: BoardState): void;
}

export type BoardSessionDependencies = {
  persistence: BoardPersistence;
  canvas?: BoardCanvas;
};

export type BoardSessionStatus = "idle" | "loading" | "saving" | "saved" | "error";
export type BoardLoadStatus = "available" | "missing" | "unavailable";

type Listener = () => void;
type StateListener = (state: BoardState) => void;

export class BoardSession {
  private currentState: BoardState | null = null;
  private currentStatus: BoardSessionStatus = "idle";
  private currentLoadStatus: BoardLoadStatus = "missing";
  private readonly stateListeners = new Set<StateListener>();
  private readonly statusListeners = new Set<Listener>();

  constructor(private readonly dependencies: BoardSessionDependencies) {}

  get state(): BoardState | null {
    return this.currentState;
  }

  get status(): BoardSessionStatus {
    return this.currentStatus;
  }

  get loadStatus(): BoardLoadStatus {
    return this.currentLoadStatus;
  }

  subscribe(listener: Listener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  async start(): Promise<BoardState> {
    this.setStatus("loading");
    try {
      const savedState = await this.dependencies.persistence.load();
      this.currentLoadStatus = savedState ? "available" : "missing";
      this.currentState = savedState ?? { elements: [] };
      this.dependencies.canvas?.display(this.currentState);
      this.notifyStateListeners();
      this.setStatus("idle");
      return this.currentState;
    } catch (error) {
      this.currentLoadStatus = "unavailable";
      this.setStatus("error");
      throw error;
    }
  }

  async handleLocalSceneChange(state: BoardState): Promise<void> {
    this.currentState = state;
    this.notifyStateListeners();
    this.setStatus("saving");
    try {
      await this.dependencies.persistence.save(state);
      this.setStatus("saved");
    } catch (error) {
      this.setStatus("error");
      throw error;
    }
  }

  async handleRemoteScene(state: BoardState): Promise<void> {
    this.currentState = state;
    this.dependencies.canvas?.display(state);
    this.notifyStateListeners();
    await this.dependencies.persistence.save(state);
  }

  private setStatus(status: BoardSessionStatus): void {
    this.currentStatus = status;
    this.notify(this.statusListeners);
  }

  private notifyStateListeners(): void {
    if (!this.currentState) {
      return;
    }
    for (const listener of this.stateListeners) {
      listener(this.currentState);
    }
  }

  private notify(listeners: Set<Listener>): void {
    for (const listener of listeners) {
      listener();
    }
  }
}
