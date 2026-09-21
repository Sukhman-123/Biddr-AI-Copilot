declare module "cloudflare:workers" {
  // Module augmentation requires an interface so the binding type is merged.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ProvidedEnv extends Env {}
}
