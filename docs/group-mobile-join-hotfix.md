# Group mobile/join hotfix

This hotfix addresses two production usability issues reported during Stage 9 testing:

- wider Group standings are constrained to the Group panel and horizontally scroll on narrow screens rather than bursting beyond the viewport;
- after a successful invite join, the Group client tracks the newly joined Group and retries the immediate profile-Group read for a short bounded window until the new membership becomes visible, allowing the existing Group Hub refresh to select and display it without a full page refresh.

The retry applies only after a successful `group_join` result and clears as soon as the joined Group is visible. Ordinary Group reads remain single-request reads.
