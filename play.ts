import { Actor, Follow, Person, lookupObject } from "fedify";
import { federation } from "./federation.ts";

const ctx = federation.createContext({
  url: "https://3a01-172-90-234-126.ngrok-free.app/users/me",
} as Request);

console.log(ctx);

const recipient = (await lookupObject(
  "https://activitypub.academy/@babicia_vepas",
)) as Actor;

await ctx.sendActivity(
  { handle: "@me@3a01-172-90-234-126.ngrok-free.app" },
  recipient,
  new Follow({
    actor: ctx.getActorUri("@me@3a01-172-90-234-126.ngrok-free.app"),
    object: recipient!.id,
  }),
  { immediate: true },
);
