<template>
  <div class="relative overflow-x-clip bg-[#07090f] text-white min-h-screen">
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute -top-44 left-1/2 -translate-x-1/2 w-[90rem] h-[34rem] bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-emerald-500/20 blur-3xl" />
      <div class="absolute top-[32rem] -left-40 w-96 h-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div class="absolute top-[68rem] -right-40 w-[28rem] h-[28rem] rounded-full bg-emerald-400/10 blur-3xl" />
    </div>

    <header class="sticky top-0 z-20 backdrop-blur-xl bg-[#07090f]/75 border-b border-white/10">
      <div class="max-w-6xl mx-auto px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
        <RouterLink to="/" class="text-lg font-semibold tracking-tight">wavelength</RouterLink>
        <RouterLink to="/auth" class="btn-primary text-sm">Get Started</RouterLink>
      </div>
    </header>

    <main class="relative z-10 space-y-6 md:space-y-10">
      <section class="max-w-6xl mx-auto px-4 sm:px-5 pt-12 pb-10 sm:pt-16 md:pt-24 md:pb-12">
        <p class="text-xs tracking-wider uppercase text-cyan-200/80 mb-6">
          Built for Collaboration.
        </p>

        <h1 class="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-semibold leading-tight tracking-tight max-w-5xl">
          Plan the setlist together,
          <span class="block bg-gradient-to-r from-cyan-300 via-blue-300 to-emerald-300 text-transparent bg-clip-text">from first idea to final encore.</span>
        </h1>

        <p class="mt-7 text-base md:text-lg text-slate-300 max-w-3xl leading-relaxed">
          Wavelength is collaborative setlist planning for bands. Curate songs, vote in real time, and lock a final list everyone can trust before the show.
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <RouterLink to="/auth" class="btn-primary px-6 py-3 text-sm">Create your first gig</RouterLink>
          <a href="#feature-bubbles" class="btn-secondary px-6 py-3 text-sm">Learn more</a>
        </div>

        <div id="feature-bubbles" class="mt-9 grid md:grid-cols-3 gap-3 scroll-mt-28 md:scroll-mt-32">
          <div class="rounded-2xl border border-cyan-300/30 bg-gradient-to-b from-cyan-400/10 to-white/5 p-4 transition-transform duration-300 hover:-translate-y-1 hover:bg-white/10">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-xl bg-cyan-400/20 border border-cyan-300/40 flex items-center justify-center text-base">⚡</div>
              <div>
                <p class="text-xs text-cyan-100/85 tracking-wide uppercase">Live Collaboration</p>
                <p class="text-sm mt-1">Votes and reactions sync instantly across every bandmate.</p>
              </div>
            </div>
          </div>
          <div class="rounded-2xl border border-emerald-300/30 bg-gradient-to-b from-emerald-400/10 to-white/5 p-4 transition-transform duration-300 hover:-translate-y-1 hover:bg-white/10">
            <div class="flex items-start gap-3">
              <div class="h-9 px-2 rounded-xl bg-emerald-400/20 border border-emerald-300/40 flex items-center justify-center gap-1.5">
                <span class="w-4 h-4 rounded-full bg-[#1DB954] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" class="w-2.5 h-2.5 text-black" fill="currentColor" aria-hidden="true">
                    <path d="M12 1.5A10.5 10.5 0 1 0 22.5 12 10.51 10.51 0 0 0 12 1.5Zm4.86 15.13a.66.66 0 0 1-.91.22 8.56 8.56 0 0 0-8.65-.4.66.66 0 0 1-.6-1.18 9.89 9.89 0 0 1 10 .45.66.66 0 0 1 .16.91Zm1.3-2.35a.82.82 0 0 1-1.13.27 10.66 10.66 0 0 0-10.77-.48.82.82 0 1 1-.74-1.46 12.3 12.3 0 0 1 12.42.55.82.82 0 0 1 .22 1.12Zm.11-2.52a13 13 0 0 0-13.12-.57.98.98 0 1 1-.89-1.74 14.93 14.93 0 0 1 15.08.66.98.98 0 0 1-1.07 1.65Z"/>
                  </svg>
                </span>
                <span class="w-4 h-4 rounded-[4px] bg-[#FF0000] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" class="w-2.5 h-2.5 text-white" fill="currentColor" aria-hidden="true">
                    <path d="M19.6 7.2a2.5 2.5 0 0 0-1.8-1.8C16.2 5 12 5 12 5s-4.2 0-5.8.4a2.5 2.5 0 0 0-1.8 1.8C4 8.8 4 12 4 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C7.8 19 12 19 12 19s4.2 0 5.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10.4 15.1V8.9L15.8 12Z"/>
                  </svg>
                </span>
              </div>
              <div>
                <p class="text-xs text-emerald-100/85 tracking-wide uppercase">Search and Preview</p>
                <p class="text-sm mt-1">Pull songs from Spotify and YouTube with fast fallback playback.</p>
              </div>
            </div>
          </div>
          <div class="rounded-2xl border border-amber-300/30 bg-gradient-to-b from-amber-400/10 to-white/5 p-4 transition-transform duration-300 hover:-translate-y-1 hover:bg-white/10">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-base">🧾</div>
              <div>
                <p class="text-xs text-amber-100/85 tracking-wide uppercase">Show-Ready Summary</p>
                <p class="text-sm mt-1">Lock rankings, tune set order, add keys, notes, and voice memos.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" class="max-w-6xl mx-auto px-5 py-2 md:py-4">
        <div class="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f1725] to-[#0b111a] p-7 md:p-10">
          <p class="text-xs tracking-wider uppercase text-blue-200/80">How It Works</p>
          <h2 class="text-2xl md:text-4xl font-semibold mt-2">A clear flow from idea to show night.</h2>
          <p class="text-slate-300 mt-4 max-w-3xl leading-relaxed">
            Wavelength follows a simple sequence your whole band can understand. Move step by step and finish with a locked, production-ready set.
          </p>

          <div class="mt-7 space-y-3">
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
              <div class="flex items-start gap-3 md:gap-4">
                <div class="w-14 md:w-16 shrink-0 flex justify-center">
                  <div class="w-10 h-10 rounded-full bg-cyan-400/20 border border-cyan-300/40 flex items-center justify-center text-lg">🎸</div>
                </div>
                <div>
                  <p class="text-sm font-semibold">1. Create or Join a Gig</p>
                  <p class="text-xs text-slate-300 mt-1">Start a new workspace or join one with an invite code.</p>
                </div>
              </div>
            </div>

            <div class="flex justify-center text-slate-500 text-sm">↓</div>

            <div class="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
              <div class="flex items-start gap-3 md:gap-4">
                <div class="w-14 md:w-16 shrink-0 flex justify-center">
                  <div class="w-10 h-10 rounded-full bg-emerald-400/20 border border-emerald-300/40 flex items-center justify-center text-lg">👥</div>
                </div>
                <div>
                  <p class="text-sm font-semibold">2. Invite Your Bandmates</p>
                  <p class="text-xs text-slate-300 mt-1">Share the gig code so everyone can contribute in the same place.</p>
                </div>
              </div>
            </div>

            <div class="flex justify-center text-slate-500 text-sm">↓</div>

            <div class="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
              <div class="flex items-start gap-3 md:gap-4">
                <div class="w-14 md:w-16 shrink-0 flex justify-center">
                  <div class="h-10 px-2 rounded-full bg-violet-400/20 border border-violet-300/40 flex items-center justify-center gap-1.5">
                    <span class="w-4 h-4 rounded-full bg-[#1DB954] flex items-center justify-center">
                      <svg viewBox="0 0 24 24" class="w-2.5 h-2.5 text-black" fill="currentColor" aria-hidden="true">
                        <path d="M12 1.5A10.5 10.5 0 1 0 22.5 12 10.51 10.51 0 0 0 12 1.5Zm4.86 15.13a.66.66 0 0 1-.91.22 8.56 8.56 0 0 0-8.65-.4.66.66 0 0 1-.6-1.18 9.89 9.89 0 0 1 10 .45.66.66 0 0 1 .16.91Zm1.3-2.35a.82.82 0 0 1-1.13.27 10.66 10.66 0 0 0-10.77-.48.82.82 0 1 1-.74-1.46 12.3 12.3 0 0 1 12.42.55.82.82 0 0 1 .22 1.12Zm.11-2.52a13 13 0 0 0-13.12-.57.98.98 0 1 1-.89-1.74 14.93 14.93 0 0 1 15.08.66.98.98 0 0 1-1.07 1.65Z"/>
                      </svg>
                    </span>
                    <span class="w-4 h-4 rounded-[4px] bg-[#FF0000] flex items-center justify-center">
                      <svg viewBox="0 0 24 24" class="w-2.5 h-2.5 text-white" fill="currentColor" aria-hidden="true">
                        <path d="M19.6 7.2a2.5 2.5 0 0 0-1.8-1.8C16.2 5 12 5 12 5s-4.2 0-5.8.4a2.5 2.5 0 0 0-1.8 1.8C4 8.8 4 12 4 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C7.8 19 12 19 12 19s4.2 0 5.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10.4 15.1V8.9L15.8 12Z"/>
                      </svg>
                    </span>
                  </div>
                </div>
                <div>
                  <p class="text-sm font-semibold">3. Add Songs</p>
                  <p class="text-xs text-slate-300 mt-1">Search Spotify/YouTube and build your candidate setlist together.</p>
                </div>
              </div>
            </div>

            <div class="flex justify-center text-slate-500 text-sm">↓</div>

            <div class="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
              <div class="flex items-start gap-3 md:gap-4">
                <div class="w-14 md:w-16 shrink-0 flex justify-center">
                  <div class="h-10 px-2 rounded-full bg-yellow-400/20 border border-yellow-300/40 flex items-center justify-center gap-1 text-sm">
                    <span>🔥</span>
                    <span>❤️</span>
                    <span>👍</span>
                  </div>
                </div>
                <div>
                  <p class="text-sm font-semibold">4. Vote, React, Comment</p>
                  <p class="text-xs text-slate-300 mt-1">Use up/down voting, emoji reactions, and comments to shape consensus live.</p>
                </div>
              </div>
            </div>

            <div class="flex justify-center text-slate-500 text-sm">↓</div>

            <div class="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
              <div class="flex items-start gap-3 md:gap-4">
                <div class="w-14 md:w-16 shrink-0 flex justify-center">
                  <div class="w-10 h-10 rounded-full bg-pink-400/20 border border-pink-300/40 flex items-center justify-center text-lg">📊</div>
                </div>
                <div>
                  <p class="text-sm font-semibold">5. Close Voting and Finalize</p>
                  <p class="text-xs text-slate-300 mt-1">Review analytics in the summary, reorder songs, and add keys, notes, and voice memos.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="max-w-6xl mx-auto px-5 pt-8 pb-16 md:pt-10 md:pb-20">
        <div class="rounded-3xl border border-cyan-300/20 bg-gradient-to-r from-cyan-500/15 to-blue-500/15 p-8 md:p-12 text-center">
          <h2 class="text-3xl md:text-4xl font-semibold tracking-tight">Ready to shape your next set?</h2>
          <p class="text-slate-200/90 mt-3 max-w-2xl mx-auto">
            Bring your band into one workspace, vote with clarity, and walk into your next show with a confident final setlist.
          </p>
          <div class="mt-7 flex items-center justify-center gap-3 flex-wrap">
            <RouterLink to="/auth" class="btn-primary px-6 py-3 text-sm">Start with Wavelength</RouterLink>
            <a href="#" class="btn-secondary px-6 py-3 text-sm">Review Features Again</a>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>
