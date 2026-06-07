import { useEffect } from "react";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type UseAIPulseAnimationOptions = {
  thinking: boolean;
};

const SPRING_CONFIG = {
  damping: 15,
  mass: 0.65,
  stiffness: 210,
};

export function useAIPulseAnimation({ thinking }: UseAIPulseAnimationOptions) {
  const pressScale = useSharedValue(1);
  const entranceY = useSharedValue(20);
  const entranceOpacity = useSharedValue(0);
  const ringRotation = useSharedValue(0);

  useEffect(() => {
    entranceY.value = withDelay(
      120,
      withSpring(0, {
        damping: 16,
        mass: 0.7,
        stiffness: 180,
      }),
    );
    entranceOpacity.value = withDelay(80, withTiming(1, { duration: 360 }));
  }, [entranceOpacity, entranceY]);

  useEffect(() => {
    ringRotation.value = thinking
      ? withTiming(360, {
          duration: 1800,
          easing: Easing.linear,
        })
      : withTiming(0, { duration: 180 });
  }, [ringRotation, thinking]);

  const runPressAnimation = () => {
    pressScale.value = withSequence(
      withSpring(0.92, SPRING_CONFIG),
      withSpring(1.12, SPRING_CONFIG),
      withSpring(1, SPRING_CONFIG),
    );
  };

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [
      { translateY: entranceY.value },
      { scale: pressScale.value },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: thinking ? 1 : 0,
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));

  return {
    buttonStyle,
    ringStyle,
    runPressAnimation,
  };
}
