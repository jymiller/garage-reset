export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <button
      onClick={onStart}
      className="relative flex min-h-screen w-full flex-col items-center justify-between overflow-hidden text-center"
      aria-label="Press start"
    >
      <img src="/art/ui/title.png" alt="" className="absolute inset-0 h-full w-full object-cover" />

      <div className="relative z-10 w-full px-4 pt-12">
        <h1 className="arc-shadow font-pixel text-2xl leading-relaxed text-[#2bd14a]">
          GARAGE
          <br />
          RESET
        </h1>
      </div>

      <div className="relative z-10 w-full border-t-2 border-[#2bd14a] bg-[#07070e] px-4 py-5 text-center">
        <p className="arc-blink font-pixel text-base text-[#ffd23f]">PRESS START</p>
        <p className="font-pixel mt-2.5 text-[8px] text-[#36e0e0]">TAP ANYWHERE TO BEGIN</p>
        <p className="font-pixel mt-3 text-[7px] text-[#5a5a70]">INSERT COIN · 1 CREDIT</p>
      </div>
    </button>
  )
}
