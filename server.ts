import { federation } from "./federation.ts";
import * as shed from "shed";

const router = new shed.WorkerRouter();

router.get("users/:handle/followers", (req, ctx) => {
  const { handle } = ctx.match.pathname.groups;

  return new shed.JSONResponse({
    followers: [],
  });
});

router.any("*", (req, ctx) => {
  return federation.fetch(req, {
    contextData: undefined,
  });
});

Deno.serve(router.serveCallback);
