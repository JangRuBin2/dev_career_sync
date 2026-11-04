/**
 * @notionhq/client 는 CommonJS 라 Node ESM(tsx) 에서 named import 가 깨진다.
 * 번들러(Next)와 Node ESM 양쪽에서 동작하도록 default/namespace 를 정규화해 재노출한다.
 */
import * as sdk from "@notionhq/client";

type Sdk = typeof sdk;
const mod: Sdk = ((sdk as unknown as { default?: Sdk }).default ?? sdk) as Sdk;

export const Client = mod.Client;
export type Client = InstanceType<Sdk["Client"]>;
export const collectPaginatedAPI = mod.collectPaginatedAPI;
export const isFullPage = mod.isFullPage;
export const verifyWebhookSignature = mod.verifyWebhookSignature;
