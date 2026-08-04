"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, PlugZap, Save, XCircle } from "lucide-react";
// import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  API_URL_STORAGE_KEY,
  getApiBaseUrl,
  getErrorMessage,
  getHealth,
  setApiBaseUrl,
} from "@/lib/api";
import { toast } from "sonner";

type ConnectionStatus = "idle" | "testing" | "connected" | "failed";

const fallbackApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// Optional: fallback header if ShellProvider is missing
function FallbackHeader() {
  return (
      <div className="px-4 py-6 md:px-8">
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-[#71717A] text-sm mb-4">
          Configure the portal API endpoint and review platform details.
        </p>
      </div>
  );
}

export default function SettingsPage() {
  const [apiUrl, setApiUrlState] = useState(fallbackApiUrl);
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  useEffect(() => {
    const stored = window.localStorage.getItem(API_URL_STORAGE_KEY);
    if (stored && stored.trim()) {
      setApiUrlState(stored.trim());
    } else {
      setApiUrlState(getApiBaseUrl());
    }
  }, []);

  const handleSave = () => {
    setApiBaseUrl(apiUrl);
    toast.success("API endpoint saved");
  };

  const handleTestConnection = async () => {
    setStatus("testing");
    setApiBaseUrl(apiUrl);

    try {
      await getHealth();
      setStatus("connected");
      toast.success("Connected");
    } catch (error) {
      setStatus("failed");
      toast.error(getErrorMessage(error));
    }
  };

  return (
      <>
        {/* If you are sure ShellProvider is present, use <Topbar ... /> */}
        {/* <Topbar title="Settings" description="Configure the portal API endpoint and review platform details." /> */}
        {/* Otherwise, use a fallback header: */}
        <FallbackHeader />

        <div className="space-y-6 px-4 py-6 md:px-8">
          <Card className="border-[#27272A] bg-[#1A1A1A]">
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Point the portal at the MassiCloud API running locally or in your environment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="api-url">API Endpoint</Label>
                <Input
                    id="api-url"
                    value={apiUrl}
                    onChange={(event) => setApiUrlState(event.target.value)}
                    placeholder="http://localhost:8080"
                    autoComplete="off"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={handleTestConnection} disabled={status === "testing"}>
                  {status === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                  Test Connection
                </Button>
                {status === "connected" ? (
                    <Badge variant="success" className="border">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Connected
                    </Badge>
                ) : status === "failed" ? (
                    <Badge variant="danger" className="border">
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      Failed
                    </Badge>
                ) : null}
                <div className="ml-auto flex items-center gap-3">
                  <Button type="button" onClick={handleSave}>
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#27272A] bg-[#1A1A1A]">
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>Portal and compliance details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#A1A1AA]">
              <p className="text-base font-medium text-[#FAFAFA]">MassiCloud version: 0.1.0</p>
              <p>🇩🇿 Sovereign Algerian Cloud Infrastructure</p>
              <p>Law 18-07 compliance note: data stored exclusively in Algeria.</p>
            </CardContent>
          </Card>
        </div>
      </>
  );
}
