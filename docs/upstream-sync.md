# Upstream synchronization

> Historical v3.3.5 snapshot. The current Fork release is [v3.3.6](v3.3.6.md), which removes the extra request controls. Its publication does not update the upstream PR described below.

Fork [v3.3.5](https://github.com/hhhoratioxu/WeatherKit/releases/tag/v3.3.5) publishes both Loon and Surge. [NSRingo/WeatherKit #107](https://github.com/NSRingo/WeatherKit/pull/107) is Open and Ready for review, not merged. The original maintainer controls upstream acceptance and publication.

The upstream contribution remains scoped to the existing Loon compatibility, data handling and bounded provider work. It includes the WK3 warning UUID correction and the original parameter-semantics audit. It does not copy Fork subscription URLs, generated release files or the new Surge distribution into the original repository. The upstream package name, version policy and release URLs are preserved.

Current head: 355b5f5dad9d01cb13167949f8334a489b301811, based on upstream c40e8f8; seven commits and 72 files. The latest commit only updates documentation. Code commit 4d1f127 passed the locked [Actions build](https://github.com/hhhoratioxu/WeatherKit/actions/runs/42234270265): 335 regressions, 40 compiled VM scenarios, 15 expression/route/jq checks and twelve original defaults. The five-file artifact was downloaded and reexecuted, and its three runtime files are byte-identical to the Mac candidate that was observed.

The current Fork additionally enables native Surge storage, timeouts and entry points, so its final runtime bytes differ from that earlier candidate. The final Fork was built locally using Node v24.22.1, with 345 regressions, Loon 40/15 and Surge 29 compiled scenarios recorded before publication. These are distinguished from native observations and do not establish native Surge, device battery or memory acceptance.

[Publication receipt](v3.3.5-publication-verification.json) records nineteen assets and 57 matching public files across Release, tag and main. [Structured upstream state](upstream-sync-validation.json) and [Mac observations](mac-native-observations-v3.3.5.json) retain the exact boundaries. Previous v3.3.4 synchronization data is archived in [the historical snapshot](upstream-sync-validation-v3.3.4.json).
