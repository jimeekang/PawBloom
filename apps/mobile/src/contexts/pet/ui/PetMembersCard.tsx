import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { NoticeBanner, PrimaryButton, SecondaryButton, SurfaceCard } from "../../../design-system/components";
import { confirmDestructiveAction } from "../../../design-system/confirmAction";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import type { Entitlement } from "../../subscription/domain/entitlement";
import type { PetProfile } from "../domain/pet";
import {
  PetMemberRequestError,
  useInvitePetMember,
  usePetMembers,
  useRemovePetMember,
  type PetMember,
  type PetMemberErrorCode,
} from "../application/petMembers";

export function PetMembersCard({
  pet,
  configured,
  userId,
  entitlement,
  entitlementLoading,
  entitlementFailed,
}: {
  pet: PetProfile;
  configured: boolean;
  userId: string | null;
  entitlement: Entitlement | null;
  entitlementLoading: boolean;
  entitlementFailed: boolean;
}) {
  const owner = pet.role === "owner";
  const membersQuery = usePetMembers(pet.id, userId, configured && owner);
  const inviteMutation = useInvitePetMember(pet.id, userId);
  const removeMutation = useRemovePetMember(pet.id, userId);
  const [email, setEmail] = useState("");
  const [noticeKey, setNoticeKey] = useState<TranslationKey | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const previewMembers: PetMember[] = [{
    membershipId: "preview-owner",
    email: t("ko", "settings.membersPreviewOwner"),
    role: "owner",
    status: "active",
    startsAt: null,
    endsAt: null,
    isCurrentUser: true,
  }];
  const members = configured ? membersQuery.data ?? [] : previewMembers;
  const inviteEnabled = configured && Boolean(entitlement?.familySharingEnabled);
  const busy = inviteMutation.isPending || removeMutation.isPending;

  async function invite() {
    setNoticeKey(null);
    setErrorKey(null);
    try {
      await inviteMutation.mutateAsync(email);
      setEmail("");
      setNoticeKey("settings.membersInvited");
    } catch (error) {
      setErrorKey(memberErrorKey(error));
    }
  }

  async function remove(member: PetMember) {
    setNoticeKey(null);
    setErrorKey(null);
    await confirmDestructiveAction({
      title: t("ko", "settings.membersRemoveTitle"),
      message: t("ko", "settings.membersRemoveCopy").replace("{email}", member.email || t("ko", "settings.membersUnknown")),
      cancelText: t("ko", "settings.membersRemoveCancel"),
      confirmText: t("ko", "settings.membersRemoveConfirm"),
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
            <Text style={styles.title}>{t("ko", "settings.membersTitle")}</Text>
            <Text style={styles.copy}>{t("ko", "settings.membersCopy").replace("{petName}", pet.name)}</Text>
          </View>
        </View>

        {!owner ? <NoticeBanner text={t("ko", "settings.membersOwnerOnly")} icon="shield" /> : null}
        {owner && membersQuery.isLoading ? <Text style={styles.copy}>{t("ko", "settings.membersLoading")}</Text> : null}
        {owner && membersQuery.isError ? <NoticeBanner text={t("ko", "settings.membersListFailed")} icon="close" tone="error" /> : null}
        {owner ? members.map((member) => <MemberRow key={member.membershipId} member={member} busy={busy} onRemove={remove} />) : null}

        {owner && entitlementLoading ? <NoticeBanner text={t("ko", "settings.planLoading")} icon="lock" /> : null}
        {owner && entitlementFailed ? <NoticeBanner text={t("ko", "settings.planLoadFailed")} icon="close" tone="error" /> : null}
        {owner && entitlement && !entitlement.familySharingEnabled ? <NoticeBanner text={t("ko", "settings.membersFamilyLocked")} icon="lock" /> : null}
        {owner && entitlement?.familySharingEnabled && !configured ? <NoticeBanner text={t("ko", "settings.membersAccountRequired")} icon="shield" /> : null}
        {owner && entitlement?.familySharingEnabled ? (
          <View style={styles.inviteBlock}>
            <Text style={styles.fieldLabel}>{t("ko", "settings.membersInviteLabel")}</Text>
            <TextInput
              accessibilityLabel={t("ko", "settings.membersInviteLabel")}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t("ko", "settings.membersInvitePlaceholder")}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!busy}
            />
            <PrimaryButton label={t("ko", "settings.membersInvite")} icon="add" onPress={() => void invite()} disabled={!inviteEnabled || !email.trim() || busy} />
          </View>
        ) : null}

        {noticeKey ? <NoticeBanner text={t("ko", noticeKey)} icon="check" /> : null}
        {errorKey ? <NoticeBanner text={t("ko", errorKey)} icon="close" tone="error" /> : null}
      </View>
    </SurfaceCard>
  );
}

function MemberRow({ member, busy, onRemove }: { member: PetMember; busy: boolean; onRemove: (member: PetMember) => Promise<void> }) {
  return (
    <View style={styles.memberRow}>
      <View style={styles.memberCopy}>
        <Text style={styles.memberEmail}>{member.email || t("ko", "settings.membersUnknown")}</Text>
        <Text style={styles.memberMeta}>
          {t("ko", `settings.membersRole.${member.role}` as const)} · {t("ko", `settings.membersStatus.${member.status}` as const)}
        </Text>
      </View>
      {!member.isCurrentUser && member.role !== "owner"
        ? <SecondaryButton label={t("ko", "settings.membersRemove")} icon="close" onPress={() => void onRemove(member)} disabled={busy} />
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
  familyPlanRequired: "settings.membersFamilyLocked",
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
  inviteBlock: { gap: spacing.sm },
  fieldLabel: { ...type.bodyStrong },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    ...type.body,
  },
});
