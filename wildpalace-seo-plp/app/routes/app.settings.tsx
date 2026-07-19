import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await db.shopSettings.findUnique({ where: { shop } });

  return {
    settings: settings ?? {
      aiProvider: "mistral",
      aiModel: "mistral-large-latest",
      defaultLocale: "en-US",
      brandTone: "",
      competitorUrls: "",
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const aiProvider = String(formData.get("aiProvider") ?? "mistral");
  const aiModel = String(formData.get("aiModel") ?? "");
  const defaultLocale = String(formData.get("defaultLocale") ?? "en-US");
  const brandTone = String(formData.get("brandTone") ?? "");
  const competitorUrls = String(formData.get("competitorUrls") ?? "");

  await db.shopSettings.upsert({
    where: { shop },
    create: { shop, aiProvider, aiModel, defaultLocale, brandTone, competitorUrls },
    update: { aiProvider, aiModel, defaultLocale, brandTone, competitorUrls },
  });

  return { saved: true };
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [aiProvider, setAiProvider] = useState(settings.aiProvider);
  const [aiModel, setAiModel] = useState(settings.aiModel);
  const [defaultLocale, setDefaultLocale] = useState(settings.defaultLocale);
  const [brandTone, setBrandTone] = useState(settings.brandTone);
  const [competitorUrls, setCompetitorUrls] = useState(settings.competitorUrls);

  const handleSave = () => {
    fetcher.submit(
      { aiProvider, aiModel, defaultLocale, brandTone, competitorUrls },
      { method: "POST" },
    );
  };

  return (
    <s-page heading="Settings">
      <s-section heading="AI Provider">
        <s-paragraph>
          Note: the API key itself is configured via environment variable
          (ANTHROPIC_API_KEY / MISTRAL_API_KEY), not stored here, for security.
          This selects which provider/model the app uses.
        </s-paragraph>
        <s-stack direction="block" gap="base">
          <s-select label="Provider" value={aiProvider} onChange={(e: any) => setAiProvider(e.target.value)}>
            <s-option value="mistral">Mistral</s-option>
            <s-option value="anthropic">Claude (Anthropic)</s-option>
          </s-select>
          <s-text-field label="Model" value={aiModel} onChange={(e: any) => setAiModel(e.target.value)} />
        </s-stack>
      </s-section>

      <s-section heading="Defaults">
        <s-select label="Default locale" value={defaultLocale} onChange={(e: any) => setDefaultLocale(e.target.value)}>
          <s-option value="en-US">English (US)</s-option>
          <s-option value="en-AU">English (Australia)</s-option>
          <s-option value="de-DE">German</s-option>
        </s-select>
      </s-section>

      <s-section heading="Brand">
        <s-text-field
          label="Brand tone"
          value={brandTone}
          onChange={(e: any) => setBrandTone(e.target.value)}
          placeholder="e.g. warm, premium, sustainability-focused"
        />
        <s-text-field
          label="Competitor URLs (comma-separated)"
          value={competitorUrls}
          onChange={(e: any) => setCompetitorUrls(e.target.value)}
        />
      </s-section>

      <s-button onClick={handleSave} {...(fetcher.state !== "idle" ? { loading: true } : {})}>
        Save Settings
      </s-button>
      {fetcher.data?.saved && <s-paragraph>Saved.</s-paragraph>}
    </s-page>
  );
}
