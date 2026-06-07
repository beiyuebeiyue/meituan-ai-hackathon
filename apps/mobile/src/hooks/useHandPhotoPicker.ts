import * as ImagePicker from "expo-image-picker";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import { UserHandPhoto } from "../types/api";

export type HandReadyPayload = {
  imageUri: string;
  handPhotoId?: string | null;
};

type UseHandPhotoPickerOptions = {
  enabled?: boolean;
  limit?: number;
  onHandReady: (payload: HandReadyPayload) => void;
};

export function useHandPhotoPicker({ enabled = true, limit = 5, onHandReady }: UseHandPhotoPickerOptions) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const savedHandsQuery = useQuery({
    queryKey: ["saved-hand-photos", user?.id ?? "anonymous"],
    queryFn: api.getSavedHandPhotos,
    enabled: !!token && !!user && enabled,
  });

  const recentHandPhotos = (savedHandsQuery.data?.items ?? []).slice(0, limit);

  const handleSavedHandSelect = (item: UserHandPhoto) => {
    onHandReady({
      imageUri: resolveAssetUrl(item.image_url),
      handPhotoId: item.id,
    });
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (!result.canceled) {
      onHandReady({ imageUri: result.assets[0].uri, handPhotoId: null });
    }
  };

  const takePhotoNow = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("需要相机权限", "请允许焕甲使用相机，才能现场拍摄手图。");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (!result.canceled) {
        onHandReady({ imageUri: result.assets[0].uri, handPhotoId: null });
      }
    } catch {
      Alert.alert("暂时无法打开相机", "你也可以先从相册里选一张之前拍好的手图。");
    }
  };

  return {
    token,
    savedHandsQuery,
    recentHandPhotos,
    handleSavedHandSelect,
    pickFromLibrary,
    takePhotoNow,
  };
}
