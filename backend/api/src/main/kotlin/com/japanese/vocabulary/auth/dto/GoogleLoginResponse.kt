package com.japanese.vocabulary.auth.dto

/**
 * Discriminated response for POST /api/auth/google. Either the user is already
 * registered ("authenticated", token+name set) or needs to complete signup
 * ("needsSignup", identity set so the client can prefill the Sign Up screen).
 */
data class GoogleLoginResponse(
    val kind: Kind,
    val token: String? = null,
    val name: String? = null,
    val identity: VerifiedIdentityResponse? = null,
) {
    enum class Kind { authenticated, needsSignup }

    companion object {
        fun authenticated(auth: AuthResponse) =
            GoogleLoginResponse(Kind.authenticated, token = auth.token, name = auth.name)

        fun needsSignup(identity: VerifiedIdentityResponse) =
            GoogleLoginResponse(Kind.needsSignup, identity = identity)
    }
}
