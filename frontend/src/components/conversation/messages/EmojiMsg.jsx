import Lottie from "lottie-react";
import React, { memo, useEffect, useMemo, useState } from "react";
import { EMOJI_ANIMATION_MAP } from "../emoji/animatedEmojiMap.generated.js";

const ANIMATION_CACHE = new Map();
const ANIMATION_PROMISES = new Map();

const getAnimationEntry = (emoji) => EMOJI_ANIMATION_MAP[emoji] ?? null;

const loadAnimationData = (emoji) => {
  const entry = getAnimationEntry(emoji);
  if (!entry?.loaders?.length) {
    return Promise.resolve(null);
  }
  const cacheKey = `${entry.component}-0`;
  if (ANIMATION_CACHE.has(cacheKey)) {
    return Promise.resolve(ANIMATION_CACHE.get(cacheKey));
  }
  if (ANIMATION_PROMISES.has(cacheKey)) {
    return ANIMATION_PROMISES.get(cacheKey);
  }
  const loader = entry.loaders[0];
  const promise = loader()
    .then((module) => {
      const data = module?.default ?? module;
      ANIMATION_CACHE.set(cacheKey, data);
      ANIMATION_PROMISES.delete(cacheKey);
      return data;
    })
    .catch((error) => {
      ANIMATION_PROMISES.delete(cacheKey);
      throw error;
    });
  ANIMATION_PROMISES.set(cacheKey, promise);
  return promise;
};

const EmojiMsg = memo(({ emoji, size }) => {
  if (!emoji) return null;
  const animationEntry = getAnimationEntry(emoji);
  const supportsAnimation = Boolean(animationEntry);
  const [animationData, setAnimationData] = useState(null);
  const [isClient, setIsClient] = useState(() => typeof window !== "undefined");
  const dimension = useMemo(() => size, [size]);

  useEffect(() => {
    if (isClient) return undefined;
    setIsClient(true);
    return undefined;
  }, [isClient]);

  useEffect(() => {
    let cancelled = false;
    if (!supportsAnimation || !isClient) {
      setAnimationData(null);
      return undefined;
    }
    loadAnimationData(emoji)
      .then((data) => {
        if (!cancelled) {
          setAnimationData(data);
        }
      })
      .catch((error) => {
        console.error("Failed to load emoji animation", { emoji, error });
        if (!cancelled) {
          setAnimationData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [emoji, supportsAnimation, isClient]);

  const showAnimation = supportsAnimation && Boolean(animationData);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginInline: 2,
        position: "relative",
        width: supportsAnimation ? dimension : "auto",
        height: supportsAnimation ? dimension : "auto",
      }}
    >
      <span
        data-emoji-fallback
        style={{
          position: supportsAnimation ? "absolute" : "static",
          inset: supportsAnimation ? 0 : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size - 10,
          opacity: showAnimation ? 0 : 1,
          transition: "opacity 120ms ease",
          pointerEvents: "none",
        }}
      >
        {emoji}
      </span>
      {supportsAnimation ? (
        <span
          data-emoji-animated
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: dimension,
            height: dimension,
            opacity: showAnimation ? 1 : 0,
            transition: "opacity 120ms ease",
          }}
        >
          {animationData ? (
            <Lottie
              animationData={animationData}
              loop
              autoplay
              style={{ width: dimension, height: dimension }}
            />
          ) : null}
        </span>
      ) : null}
    </span>
  );
});

export default EmojiMsg;
