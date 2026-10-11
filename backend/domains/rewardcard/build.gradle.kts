dependencies {
    // 곡 카드 등급은 곡 가사의 단계 분류와 유저 flashcard 로 잰다 — rating 과 batch 채우기가 같은 규칙을 쓴다.
    implementation(project(":domains:song"))
    implementation(project(":domains:word"))
}
