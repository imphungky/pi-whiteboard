import { Type } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";

export const whiteboardInspectTool = defineTool({
  name: "whiteboard_inspect",
  label: "Inspect Whiteboard",
  description:
    "Inspect the current whiteboard. Snapshot capture is not implemented yet.",
  parameters: Type.Object({}),

  async execute(toolCallId) {
    console.info("[pi-whiteboard] whiteboard_inspect called", { toolCallId });

    return {
      content: [
        {
          type: "text" as const,
          text: "Whiteboard inspection was called. Snapshot capture is not implemented yet.",
        },
      ],
      details: {
        status: "not_implemented" as const,
      },
    };
  },
});
