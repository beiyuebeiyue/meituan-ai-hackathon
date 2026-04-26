import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

type TryOnPayload = {
  styleId: string;
  promptText: string;
  handImageUri?: string | null;
  savedHandPhotoId?: string | null;
};

type UseTryOnLauncherOptions = {
  onSuccess?: (job: { job_id: string; status: string }) => void;
  onError?: (error: unknown) => void;
};

export function useTryOnLauncher({ onSuccess, onError }: UseTryOnLauncherOptions = {}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: TryOnPayload) => api.createTryOnJob(payload),
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: ["saved-hand-photos"] });
      void queryClient.invalidateQueries({ queryKey: ["tryon-history"] });
      onSuccess?.(job);
    },
    onError,
  });

  return {
    mutation,
    launchTryOn: mutation.mutate,
    launchTryOnAsync: mutation.mutateAsync,
  };
}
