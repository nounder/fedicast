import { Federation, Follow, MemoryKvStore, Person } from "fedify";

const federation = new Federation<void>({
  kv: new MemoryKvStore(),
  treatHttps: true,
});

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")

  .on(Follow, async (ctx, follow) => {
    if (
      follow.id == null ||
      follow.actorId == null ||
      follow.objectId == null
    ) {
      return;
    }
    const handle = ctx.getHandleFromActorUri(follow.objectId);
    if (handle !== "me") return;
    const follower = await follow.getActor(ctx);
    console.debug(follower);
  });

federation.setActorDispatcher("/users/{handle}", async (ctx, handle) => {
  if (handle !== "me") return null;
  return new Person({
    id: ctx.getActorUri(handle),
    name: "Me",
    summary: "This is me!",
    preferredUsername: handle,
    url: new URL("/", ctx.url),
    inbox: ctx.getInboxUri(handle), // Inbox URI
  });
});

export { federation };
