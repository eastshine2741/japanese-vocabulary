package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.rewardcard.config.ShareProperties
import com.japanese.vocabulary.rewardcard.model.RewardCardKind

/** `/c/{token}` HTML. DB·설정에서 온 값은 본문이든 속성이든 전부 [escape] 를 거친다. */
object RewardCardLandingPage {
    /** 카드 웹 화면이 이 id 의 script 에서 데이터를 읽는다. app-rn 의 shareWeb 과 맞춘다. */
    const val DATA_ELEMENT_ID = "kotonoha-share"

    private val HTML_LANG = Regex("<html lang=\"[^\"]*\"")
    private val TITLE = Regex("<title>.*?</title>", RegexOption.DOT_MATCHES_ALL)

    /** 카드 웹 화면 빌드의 index.html 에 이 카드의 메타와 화면 데이터를 끼운다. */
    fun inject(template: String, landing: RewardCardLanding, props: ShareProperties, dataJson: String): String {
        val head = buildString {
            append("<title>${escape(ogTitle(landing))}</title>\n")
            append(meta(landing, props))
            // JSON 안의 '<' 를 이스케이프해 문자열 값이 </script> 로 태그를 닫지 못하게 한다.
            append("""<script id="$DATA_ELEMENT_ID" type="application/json">""")
            append(dataJson.replace("<", "\\u003c"))
            append("</script>\n")
        }
        return template
            .replaceFirst(HTML_LANG, "<html lang=\"ko\"")
            .replaceFirst(TITLE, "")
            .replaceFirst("</head>", "$head</head>")
    }

    /** share-web 을 못 받았을 때 서버가 그리는 간단한 페이지. */
    fun render(landing: RewardCardLanding, props: ShareProperties): String {
        val body = buildString {
            landing.imageUrl?.let {
                append("""<img class="card" src="${escape(it)}" alt="${escape(landing.title)}">""").append('\n')
            }
            append("""<h1>${escape(landing.title)}</h1>""").append('\n')
            landing.artist?.let { append("""<p class="artist">${escape(it)}</p>""").append('\n') }
            append("""<a class="btn primary" href="${escape(props.appUrl(landing.token))}">앱에서 열기</a>""").append('\n')
            append(storeButtons(props))
        }
        return page(ogTitle(landing), meta(landing, props), body)
    }

    private fun ogTitle(landing: RewardCardLanding) =
        if (landing.artist != null) "${landing.title} - ${landing.artist}" else landing.title

    private fun meta(landing: RewardCardLanding, props: ShareProperties): String {
        val shareUrl = props.shareUrl(landing.token)
        val ogTitle = ogTitle(landing)
        val ogDescription = when (landing.kind) {
            RewardCardKind.SONG -> "${landing.ownerName}의 Kotonoha 곡 카드"
            RewardCardKind.ARTIST -> "${landing.ownerName}의 Kotonoha 아티스트 카드"
        }
        return buildString {
            meta("property", "og:type", "website")
            meta("property", "og:site_name", "Kotonoha")
            meta("property", "og:title", ogTitle)
            meta("property", "og:description", ogDescription)
            meta("property", "og:url", shareUrl)
            landing.imageUrl?.let { meta("property", "og:image", it) }
            meta("name", "twitter:card", "summary_large_image")
            meta("name", "twitter:title", ogTitle)
            meta("name", "twitter:description", ogDescription)
            landing.imageUrl?.let { meta("name", "twitter:image", it) }
            append("""<link rel="canonical" href="${escape(shareUrl)}">""").append('\n')
        }
    }

    fun renderNotFound(props: ShareProperties): String =
        page("Kotonoha", "", """<h1>카드를 찾을 수 없어요</h1>""" + "\n" + storeButtons(props))

    fun escape(value: String): String = buildString(value.length) {
        for (c in value) {
            when (c) {
                '&' -> append("&amp;")
                '<' -> append("&lt;")
                '>' -> append("&gt;")
                '"' -> append("&quot;")
                '\'' -> append("&#39;")
                else -> append(c)
            }
        }
    }

    private fun StringBuilder.meta(attr: String, key: String, content: String) {
        append("""<meta $attr="$key" content="${escape(content)}">""").append('\n')
    }

    private fun storeButtons(props: ShareProperties) = """
        <div class="stores">
        <a class="btn store" data-store="ios" href="${escape(props.iosAppStoreUrl)}">App Store</a>
        <a class="btn store" data-store="android" href="${escape(props.androidPlayUrl)}">Google Play</a>
        </div>
    """.trimIndent() + "\n"

    // JS 는 내 기기 스토어 버튼만 강조한다. 꺼져 있어도 두 버튼이 그대로 보인다.
    private fun page(title: String, meta: String, body: String) = """
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
$meta<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#0e0e13;color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;display:flex;justify-content:center}
main{width:100%;max-width:400px;padding:40px 24px;display:flex;flex-direction:column;align-items:center;text-align:center}
.card{width:100%;max-width:300px;height:auto;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.6);margin-bottom:28px}
h1{font-size:22px;margin:0 0 6px;word-break:keep-all}
.artist{margin:0;color:#a3a3b2;font-size:15px}
.btn{display:block;width:100%;padding:15px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;color:#f4f4f7;background:#23232c;margin-top:12px}
.btn.primary{background:#f4f4f7;color:#0e0e13;margin-top:32px}
.stores{width:100%;display:flex;gap:10px}
.stores .btn{flex:1;font-size:14px}
.stores .btn.mine{background:#3a3a48}
</style>
</head>
<body>
<main>
$body</main>
<script>
(function(){var ua=navigator.userAgent,s=/iPhone|iPad|iPod/.test(ua)?"ios":/Android/.test(ua)?"android":null;if(!s)return;var b=document.querySelector('[data-store="'+s+'"]');if(b)b.className+=" mine"})();
</script>
</body>
</html>
""".trimStart()
}
