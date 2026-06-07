import { useEffect } from "react";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type UseAIPulseAnimationOptions = {
  focused: boolean;
  thinking: boolean;
};

const SPRING_CONFIG = {
  damping: 15,
  mass: 0.65,
  stiffness: 210,
};

export function useAIPulseAnimation({ focused, thinking }: UseAIPulseAnimationOptions) {
  const pulseScale = useSharedValue(1);
  const glowProgress = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const entranceY = useSharedValue(20);
  const entranceOpacity = useSharedValue(0);
  const ringRotation = useSharedValue(0);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.08, {
          duration: 1250,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(1, {
          duration: 1250,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );

    glowProgress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 1250,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, {
          duration: 1250,
          easing: Easing.in(Easing.quad),
        }),
      ),
      -1,
      false,
    );

    entranceY.value = withDelay(
      120,
      withSpring(0, {
        damping: 16,
        mass: 0.7,
        stiffness: 180,
      }),
    );
    entranceOpacity.value = withDelay(80, withTiming(1, { duration: 360 }));
  }, [entranceOpacity, entranceY, glowProgress, pulseScale]);

  useEffect(() => {
    ringRotation.value = thinking
      ? withRepeat(
          withTiming(360, {
            duration: 1800,
            easing: Easing.linear,
          }),
          -1,
          false,
        )
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
      { scale: pulseScale.value * pressScale.value },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => {
    const activeBoost = focused ? 0.16 : 0;

    return {
      opacity: 0.12 + activeBoost + glowProgress.value * 0.18,
      transform: [{ scale: 0.92 + glowProgress.value * 0.2 }],
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: thinking ? 1 : 0,
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));

  return {
    buttonStyle,
    glowStyle,
    ringStyle,
    runPressAnimation,
  };
}
