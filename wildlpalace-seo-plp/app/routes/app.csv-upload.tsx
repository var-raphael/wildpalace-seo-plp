import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

function parseKeywordCsv(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstLine = lines[0]?.toLowerCase();
  const hasHeader = firstLine === "keyword" || firstLine === "keywords";
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => line.split(",")[0].replace(/^"|"$/g, "").trim())
    .filter((kw) => kw.length > 0);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const file = formData.get("csvFile");

  if (!file || !(file instanceof File)) {
    return { error: "Please choose a CSV file.", keywords: undefined };
  }

  const text = await file.text();
  const keywords = parseKeywordCsv(text);

  if (keywords.length === 0) {
    return { error: "No keywords found in the file.", keywords: undefined };
  }

  return { keywords, error: undefined };
};

export default function CsvUpload() {
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const [fileName, setFileName] = useState("");
  const isLoading = fetcher.state !== "idle";

  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const formData = new FormData();
    formData.append("csvFile", file);
    fetcher.submit(formData, { method: "POST", encType: "multipart/form-data" });
  };

  const result = fetcher.data;

  return (
    <s-page heading="CSV Keyword Upload">
      <s-section heading="Upload a keyword list">
        <s-paragraph>
          Upload a CSV with one keyword per line (a "keyword" header row is optional).
        </s-paragraph>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={isLoading}
        />
        {fileName && <s-paragraph>Selected: {fileName}</s-paragraph>}
      </s-section>

      {result && (
        <s-section heading="Result">
          {result.error && <s-paragraph>{result.error}</s-paragraph>}

          {result.keywords && (
            <s-table>
              <s-table-header-row>
                <s-table-header>Keyword</s-table-header>
                <s-table-header>Action</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {result.keywords.map((kw) => (
                  <s-table-row key={kw}>
                    <s-table-cell>{kw}</s-table-cell>
                    <s-table-cell>
                      <s-button
                        variant="tertiary"
                        onClick={() =>
                          navigate(`/app/generate?keyword=${encodeURIComponent(kw)}`)
                        }
                      >
                        Generate
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
        </s-section>
      )}
    </s-page>
  );
}
