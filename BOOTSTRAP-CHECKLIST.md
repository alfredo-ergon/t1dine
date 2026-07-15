# Bootstrap Checklist

## Ownership gate
- [ ] Source repository access
- [ ] Google Play and App Store account access
- [ ] Existing brand and domain rights
- [ ] Dataset inventory and licences
- [ ] Analytics and crash-reporting inventory
- [ ] Privacy notices and processor inventory
- [ ] User migration authority
- [ ] Existing Nightscout integration contract

## Product gate
- [ ] Launch markets and languages
- [ ] Adult, child, and caregiver scope
- [ ] Accountless mode decision
- [ ] Core and Dose Assist boundary approved
- [ ] Working name clearance started

## Engineering gate
- [ ] GitHub or Azure DevOps selected as system of record
- [ ] Azure subscriptions and environments agreed
- [ ] Least-privilege MCP credentials configured
- [ ] Synthetic data policy agreed
- [ ] Threat model reviewed
- [ ] Clinical edit approval process assigned

## Run
- [ ] `python scripts/validate_repo.py`
- [ ] `claude --permission-mode plan`
- [ ] Paste `prompts/00-initial-plan-mode.md`
