import type { OnboardingState } from "@emergence-devops/shared";
import { CheckCircle2, CircleDashed, Github, Layers3, ShieldCheck } from "lucide-react";
import { Card, CardDescription, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";

const steps = [
  { key: "accountConnected", label: "Create workspace account", icon: ShieldCheck },
  { key: "githubInstalled", label: "Install GitHub App", icon: Github },
  { key: "asanaConnected", label: "Authorize Asana", icon: Layers3 },
  { key: "boardMapped", label: "Choose parent tasks as boards", icon: CircleDashed },
  { key: "columnsMapped", label: "Map Asana custom field columns", icon: CheckCircle2 }
] as const;

export function OnboardingFlow({ state }: { state: OnboardingState }) {
  const completed = steps.filter((step) => state[step.key]).length;
  const percent = (completed / steps.length) * 100;

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          <CardTitle>Workspace activation sequence</CardTitle>
          <CardDescription className="mt-2">
            Multi-step onboarding direction selected from shadcn multi-step-form patterns, adapted for GitHub App and Asana setup.
          </CardDescription>
          <div className="mt-6 space-y-4">
            {steps.map((step, index) => {
              const complete = state[step.key];
              return (
                <div key={step.key} className="flex items-center justify-between rounded-3xl border border-outline-variant bg-surface-container-lowest px-4 py-4 shadow-[inset_0_1px_0_color-mix(in_oklch,white_72%,transparent)]">
                  <div className="flex items-center gap-4">
                    <div className={`flex size-12 items-center justify-center rounded-2xl ${complete ? "bg-success-muted text-success" : "bg-surface-container-high text-on-surface-variant"}`}>
                      <step.icon className="size-5" />
                    </div>
                    <div>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">Step {index + 1}</p>
                      <p className="font-body-lg text-body-lg font-medium text-on-surface">{step.label}</p>
                    </div>
                  </div>
                  <span className={`font-label-md text-label-md ${complete ? "text-success" : "text-on-surface-variant"}`}>
                    {complete ? "Complete" : "Pending"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-outline-variant bg-surface-container-low p-5">
          <p className="font-label-sm text-label-sm uppercase tracking-[0.12em] text-on-surface-variant">Activation</p>
          <p className="mt-4 font-headline-lg text-headline-lg font-semibold text-on-surface">{Math.round(percent)}%</p>
          <div className="mt-4">
            <Progress value={percent} />
          </div>
          <p className="mt-4 font-body-md text-body-md text-on-surface-variant">
            Workspace sign-in is handled locally for now, while GitHub and Asana keep their delegated integration grants behind the scenes.
          </p>
          <Button className="mt-6 w-full">Resume setup</Button>
        </div>
      </div>
    </Card>
  );
}
