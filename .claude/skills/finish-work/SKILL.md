---
name: finish-work
description: 이 세션에서 워크트리로 한 작업을 마무리한다. 남은 변경을 커밋하고, 메인 워크트리의 main 에 머지하고, 이 작업용으로 만든 워크트리와 브랜치를 지운다. "작업 끝", "작업 끝났어", "마무리해", "끝내자" 요청 시 사용.
---

# Finish Work

`./create-worktree.sh` 로 만든 워크트리 작업을 main 에 합치고 정리한다. 푸시·배포는 하지 않는다(요청 때만).

## 대상

- 이 세션에서 만들었거나 들어간 워크트리와 그 브랜치만 다룬다. `git worktree list` 의 다른 워크트리는 다른 세션의 진행 중 작업이라 건드리지 않는다.
- 이 세션의 서브에이전트가 `isolation: "worktree"` 로 만든 `.claude/worktrees/agent-*` 도 이 작업에 쓴 것이면 대상이다.
- 대상이 대화에서 분명하지 않으면(세션 재개·여러 워크트리) 지우기 전에 AskUserQuestion 으로 고르게 한다.

## 절차

1. **커밋** — 대상 워크트리 안에서 `git status --short` 로 남은 변경을 본다.
   - 이 작업과 상관없는 파일(스크래치 출력, 로그, 실수로 생긴 파일)은 커밋하지 않고 사용자에게 알린다. `git add -A` 대신 파일을 골라 add 한다.
   - 메시지는 레포 관례대로 한국어 한 줄 `무엇을 한다 — 왜 필요했다`, 끝에 시스템이 준 `Co-Authored-By` 줄.
   - 변경이 없고 브랜치에 main 이 모르는 커밋도 없으면(`git log main..HEAD` 가 비면) 머지는 건너뛴다.
2. **메인 워크트리로 이동** — 세션이 워크트리 안이면 `ExitWorktree(action: "keep")` 로 나온다. 워크트리 격리 중엔 `git -C <메인>` 이 막힌다. 여기서 `remove` 를 쓰지 않는 건 머지 전에 브랜치가 지워지기 때문이다.
3. **머지** — 메인 워크트리(`/home/eastshine/IdeaProjects/japanese-vocabulary`)에서:
   ```bash
   git status --short --branch          # main 이고 깨끗해야 한다
   git merge --no-ff --no-edit <branch>  # 레포 히스토리가 "Merge branch '<branch>'" 형태다
   ```
   - main 이 아니거나 추적 파일에 변경이 있으면 멈추고 알린다. 메인 워크트리를 다른 브랜치로 바꾸지 않는다.
   - 충돌이 나면 `git merge --abort` 하고 충돌 파일을 보고한 뒤 멈춘다. 워크트리는 지우지 않는다.
4. **정리** — 머지가 성공한 뒤에만:
   ```bash
   git worktree remove <worktree-path>   # --force 금지
   git branch -d <branch>                 # -D 금지
   ```
   - 복사된 gitignore 파일(.env 등)은 remove 를 막지 않는다. 그런데도 거부되면 커밋 안 된 추적·untracked 파일이 남은 것이라 `--force` 대신 그 목록을 보여 주고 묻는다.
   - `-d` 가 거부되면 머지 안 된 커밋이 있다는 뜻이다. 멈추고 알린다.
5. **dev 네임스페이스** — 워크트리에서 `./deploy.sh` 를 돌렸다면 브랜치 마지막 마디(소문자, 영숫자·`-` 외는 `-`) 이름의 namespace 가 dev 클러스터에 남는다. `kubectl --context default get ns <ns>` 로 있으면 지울지 AskUserQuestion 으로 묻고, 승인 때만 `kubectl --context default delete namespace <ns>` 한다(`teardown.sh` 는 대화형 확인이라 쓰지 않는다). `main` 은 절대 지우지 않는다.

## 보고

머지 커밋 해시, 지운 워크트리·브랜치, 남겨 둔 것과 그 이유, main 이 origin 보다 몇 커밋 앞서는지(푸시는 안 했다는 것)를 짧게 알린다.
