import { federation } from "./federation.ts";

Deno.serve((request) => federation.fetch(request, { contextData: undefined }));
