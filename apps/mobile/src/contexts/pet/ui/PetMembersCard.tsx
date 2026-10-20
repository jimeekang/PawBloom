import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DangerButton, NoticeBanner, SecondaryButton, SurfaceCard } from "../../../design-system/components";
import { confirmDestructiveAction } from "../../../design-system/confirmAction";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, spacing, type } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import type { PetProfile } from "../domain/pet";
import {
  PetMemberRequestError,
  usePetMembers,
  useRemovePetMember,
  type PetMember,
  type PetMemberErrorCode,
} from "../application/petMembers";

export function PetMembersCard({
  pet,
  configured,
  userId,
}: {
  pet: PetProfile;
  configured: boolean;
  userId: string | null;
}) {
  const owner = pet.role === "owner";
  const membersQuery = usePetMembers(pet.id, userId, configured && owner);
  const removeMutation = useRemovePetMember(pet.id, userId);
  const [noticeKey, setNoticeKey] = useState<TranslationKey | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const members = membersQuery.data ?? [];
  const busy = removeMutation.isPending;
  const hasSharedAccess = members.some((member) => member.role !== "owner" && !member.isCurrentUser);

  // Free v1 has no invitation entrypoint. Owners must still be able to revoke
  // access granted before this release, including retrying a failed list load.
  if (!configured || !owner || (!membersQuery.isLoading && !membersQuery.isError && !hasSharedAccess)) return null;

  async function remove(member: PetMember) {
    setNoticeKey(null);
    setErrorKey(null);
    await confirmDestructiveAction({
      title: t("settings.membersRemoveTitle"),
      message: t("settings.membersRemoveCopy").replace("{email}", member.email || t("settings.membersUnknown")),
      cancelText: t("settings.membersRemoveCancel"),
      confirmText: t("settings.membersRemoveConfirm"),
    }, async () => {
      try {
        await removeMutation.mutateAsync(member.membershipId);
        setNoticeKey("settings.membersRemoved");
        return true;
      } catch (error) {
        setErrorKey(memberErrorKey(error));
        return false;
      }
    });
  }

  return (
    <SurfaceCard>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppIcon name="pet" size={iconSize.md} color={colors.orangeDeep} />
          <View style={styles.titleCopy}>
            <Text style={styles.title}>{t("settings.membersTitle")}</Text>
            <Text style={styles.copy}>{t("settings.membersCopy").replace("{petName}", pet.name)}</Text>
          </View>
        </View>

        {membersQuery.isLoading ? <Text style={styles.copy}>{t("settings.membersLoading")}</Text> : null}
        {membersQuery.isError ? <NoticeBanner text={t("settings.membersListFailed")} icon="close" tone="error" /> : null}
        {membersQuery.isError ? <SecondaryButton label={t("diary.listRetry")} onPress={() => void membersQuery.refetch()} /> : null}
        {members.map((member) => <MemberRow key={member.membershipId} member={member} busy={busy} onRemove={remove} />)}

        {noticeKey ? <NoticeBanner text={t(noticeKey)} icon="check" tone="success" /> : null}
        {errorKey ? <NoticeBanner text={t(errorKey)} icon="close" tone="error" /> : null}
      </View>
    </SurfaceCard>
  );
}

function MemberRow({ member, busy, onRemove }: { member: PetMember; busy: boolean; onRemove: (member: PetMember) => Promise<void> }) {
  return (
    <View style={styles.memberRow}>
      <View style={styles.memberCopy}>
        <Text style={styles.memberEmail}>{member.email || t("settings.membersUnknown")}</Text>
        <Text style={styles.memberMeta}>
          {t(`settings.membersRole.${member.role}` as const)} · {t(`settings.membersStatus.${member.status}` as const)}
        </Text>
      </View>
      {!member.isCurrentUser && member.role !== "owner"
        ? <DangerButton label={t("settings.membersRemove")} icon="close" onPress={() => void onRemove(member)} disabled={busy} />
        : null}
    </View>
  );
}

function memberErrorKey(error: unknown): TranslationKey {
  const code: PetMemberErrorCode = error instanceof PetMemberRequestError ? error.code : "memberRequestFailed";
  return memberErrorKeys[code];
}

const memberErrorKeys: Record<PetMemberErrorCode, TranslationKey> = {
  accountRequired: "settings.membersAccountRequired",
  ownerRequired: "settings.membersOwnerOnly",
  familyPlanRequired: "settings.membersRequestFailed",
  invalidEmail: "settings.membersInvalidEmail",
  cannotInviteSelf: "settings.membersCannotInviteSelf",
  alreadyMember: "settings.membersAlreadyMember",
  inviteDeliveryFailed: "settings.membersInviteDeliveryFailed",
  memberListFailed: "settings.membersListFailed",
  memberRemoveFailed: "settings.membersRemoveFailed",
  memberRequestFailed: "settings.membersRequestFailed",
};

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  titleCopy: { flex: 1 },
  title: { ...type.sectionTitle },
  copy: { ...type.caption, color: colors.textMuted },
  memberRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm },
  memberCopy: { gap: spacing.xxs },
  memberEmail: { ...type.bodyStrong },
  memberMeta: { ...type.caption, color: colors.textMuted },
});
