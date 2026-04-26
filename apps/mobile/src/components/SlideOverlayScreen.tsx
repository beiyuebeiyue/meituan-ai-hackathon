import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { useRoute } from "@react-navigation/native";
import { Animated, BackHandler, Easing, StyleSheet, useWindowDimensions } from "react-native";

export type SlideDirection = "left" | "right";

type SlideOverlayScreenProps = {
  backgroundColor: string;
  direction: SlideDirection;
  onDismiss: () => void;
  children: (dismiss: () => void) => React.ReactNode;
};

const SlideOverlayDismissContext = createContext<(() => void) | null>(null);

export function useSlideOverlayDismiss() {
  return useContext(SlideOverlayDismissContext);
}

export function useOverlayDirection(defaultDirection: SlideDirection = "right") {
  const route = useRoute();
  return ((route.params as { entryEdge?: SlideDirection } | undefined)?.entryEdge ?? defaultDirection) as SlideDirection;
}

export function SlideOverlayScreen({ backgroundColor, direction, onDismiss, children }: SlideOverlayScreenProps) {
  const { width } = useWindowDimensions();
  const closingRef = useRef(false);
  const translateX = useRef(new Animated.Value(direction === "right" ? width : -width)).current;

  useEffect(() => {
    closingRef.current = false;
    translateX.setValue(direction === "right" ? width : -width);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [direction, translateX, width]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(translateX, {
      toValue: direction === "right" ? width : -width,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        closingRef.current = false;
        return;
      }
      onDismiss();
    });
  }, [direction, onDismiss, translateX, width]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss();
      return true;
    });
    return () => subscription.remove();
  }, [dismiss]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor,
          transform: [{ translateX }],
        },
      ]}
    >
      <SlideOverlayDismissContext.Provider value={dismiss}>{children(dismiss)}</SlideOverlayDismissContext.Provider>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
