import { useCallback, useEffect, useRef } from "react";
import { Animated, BackHandler, Easing, StyleSheet, useWindowDimensions } from "react-native";

type SlideDirection = "left" | "right";

type SlideOverlayScreenProps = {
  backgroundColor: string;
  direction: SlideDirection;
  onDismiss: () => void;
  children: (dismiss: () => void) => React.ReactNode;
};

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
      {children(dismiss)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
