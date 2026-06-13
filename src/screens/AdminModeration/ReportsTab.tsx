// T052: unresolved content reports tab. No persistent domain cache exists
// for reports, so this is a plain useQuery (don't invent a new cache).
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { showAlert } from '../../lib/dialogs';
import { Lucide } from '../../components/Icon';
import { Fonts, Radius } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import { adminReportsKey, useAdminReportsQuery } from '../../hooks/queries/useAdminListsQuery';
import { resolveReport, type ContentReport } from '../../services/moderation';
import type { AdminModerationStyles } from '../AdminModerationScreen.styles';

interface ReportsTabProps {
  styles: AdminModerationStyles;
}

export function ReportsTab({ styles }: ReportsTabProps) {
  const { s } = useI18n();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading: reportsLoading } = useAdminReportsQuery();
  const [resolvingReportId, setResolvingReportId] = useState<number | null>(null);

  const handleResolveReport = useCallback(async (reportId: number) => {
    setResolvingReportId(reportId);
    const { error } = await resolveReport(reportId, 'reviewed');
    setResolvingReportId(null);
    if (error) {
      showAlert(s('error'), error.message);
      return;
    }
    queryClient.setQueryData<ContentReport[]>(adminReportsKey, (prev) =>
      prev?.filter((r) => r.id !== reportId),
    );
  }, [queryClient, s]);

  return (
    <ScrollView style={styles.scroll}>
      <View style={styles.secLabel}>
        <Text style={styles.secLabelText}>{s('adminReportsHeader')}</Text>
      </View>
      {reportsLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 24 }} />
      ) : reports.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Lucide name="shield-check" size={32} color={colors.border} />
          <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint, marginTop: 8 }}>
            {s('noReports')}
          </Text>
        </View>
      ) : (
        <View style={styles.modList}>
          {reports.map((report) => {
            const resolving = resolvingReportId === report.id;
            return (
              <View key={report.id} style={[styles.modCard]} testID={`report-card-${report.id}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: colors.textFaint, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    {report.content_type} · #{report.content_id}
                  </Text>
                  <Text style={{ fontFamily: Fonts.body, fontSize: 11, color: colors.textFaint }}>
                    {new Date(report.created_at).toLocaleString()}
                  </Text>
                </View>
                <Text style={{ fontFamily: Fonts.body, fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 }}>
                  {s(`reportReason${report.reason
                    .split('_')
                    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                    .join('')}`)}
                </Text>
                {report.notes ? (
                  <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
                    {report.notes}
                  </Text>
                ) : null}
                <Text style={{ fontFamily: Fonts.body, fontSize: 11, color: colors.textFaint, marginBottom: 10 }}>
                  {s('adminReportedBy')}: {report.reporter_id.slice(0, 8)}…
                </Text>
                <TouchableOpacity
                  onPress={() => void handleResolveReport(report.id)}
                  disabled={resolving}
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: Radius.md,
                    backgroundColor: colors.primary,
                    opacity: resolving ? 0.5 : 1,
                  }}
                  testID={`resolve-report-${report.id}`}
                >
                  {resolving ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <Text style={{ fontFamily: Fonts.body, fontSize: 13, fontWeight: '600', color: colors.textOnPrimary }}>
                      {s('adminMarkResolved')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
