import {
  Accept,
  Create,
  Federation,
  Follow,
  MemoryKvStore,
  Person,
  exportJwk,
  generateCryptoKeyPair,
  importJwk,
} from "jsr:@fedify/fedify";
import { DenoKvMessageQueue, DenoKvStore } from "jsr:@fedify/fedify/x/denokv";
import { KV } from "./store.ts";

const federation = new Federation({
  kv: new DenoKvStore(),
  queue: new DenoKvMessageQueue(KV),
  treatHttps: true,
});

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    console.log("Follow:", follow);

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

    await ctx.sendActivity(
      { handle },
      follower,
      new Accept({ actor: follow.objectId, object: follow }),
    );
  });

federation
  .setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
    if (handle !== "me") return null;
    return new Person({
      id: ctx.getActorUri(handle),
      name: "Me",
      summary: "This is me!",
      preferredUsername: handle,
      url: new URL("/", ctx.url),
      inbox: ctx.getInboxUri(handle), // Inbox URI
      publicKey: key, // generated in setKeyPairDispatched
    });
  })
  .setKeyPairDispatcher(async (ctx, handle) => {
    if (handle != "me") return null; // Other than "me" is not found.

    const storeKey = ["keys", handle];
    const entry = await KV.get<{ privateKey: unknown; publicKey: unknown }>(
      storeKey,
    );

    if (entry == null || entry.value == null) {
      const { privateKey, publicKey } = await generateCryptoKeyPair();

      await KV.set(storeKey, {
        privateKey: await exportJwk(privateKey),
        publicKey: await exportJwk(publicKey),
      });
      return { privateKey, publicKey };
    }
    const privateKey = await importJwk(entry.value.privateKey, "private");
    const publicKey = await importJwk(entry.value.publicKey, "public");

    return { privateKey, publicKey };
  });

federation
  .setOutboxDispatcher(
    "/users/{handle}/outbox",
    async (ctx, handle, cursor) => {
      const posts = [];
      const items = posts.map(
        (post) =>
          new Create({
            id: new URL(`/posts/${post.id}#activity`, ctx.url),
            actor: ctx.getActorUri(handle),
            object: new Article({
              id: new URL(`/posts/${post.id}`, ctx.url),
              summary: post.title,
              content: post.content,
            }),
          }),
      );
      return { items };
    },
  )
  .setFirstCursor((ctx, handle) => {
    return "";
  });

export { federation };
