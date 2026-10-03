import CountdownFireworks from "@/components/CountdownFireworks";

export default function Page() {
  return (
    <main style={{ position: "fixed", inset: 0 }}>
      {/* <CountdownFireworks from={5} videoSrc="/video/background.mp4" lineWidth={3} hideAfter={5} /> */}
      <CountdownFireworks from={5} videoSrc="/video/hero-slow.mp4" lineWidth={3} hideAfter={5} />
      {/* <CountdownFireworks from={5} videoSrc="/video/hero-denoise.mp4" lineWidth={3} hideAfter={5} /> */}
    </main>
  );
}
