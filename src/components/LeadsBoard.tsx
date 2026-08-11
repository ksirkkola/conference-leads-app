import {
  Badge, Box, Button, Divider, Flex, Heading, HStack, SimpleGrid,
  Spinner, Stat, StatLabel, StatNumber, Text, useColorModeValue,
  useToast, VStack, Select, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalFooter, ModalCloseButton, useDisclosure,
  Textarea, FormControl, FormLabel,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_LEADS       = '6a69ee7c8c483491fc9c9c28';
const INSIGHT_CONFERENCES = '6a69f2609653a6d4e49187d9';
const WORKFLOW_ID   = '6a1940934aa20b6663634f4e';

// Phase IDs
const PHASE_NEW_LEAD      = '6a1940934aa20b6663634f4d';
const PHASE_CONTACTED     = '6a1940be0dd73026883baa6e';
const PHASE_QUALIFIED     = '6a1940c00dd73026883baa88';
const PHASE_DISQUALIFIED  = '6a1940c20dd73026883baaa2';

const PHASES = [
  { id: PHASE_NEW_LEAD,  name: 'New Lead',   color: 'blue'   },
  { id: PHASE_CONTACTED, name: 'Contacted',  color: 'purple' },
  { id: PHASE_QUALIFIED, name: 'Qualified',  color: 'green'  },
];

interface LeadRow {
  id: string;
  name: string;
  phase: string;
  phaseId: string;
  email: string | null;
  company: string | null;
  industry: string | null;
  productFamily: string | null;
  buyingStage: string | null;
  conference: string | null;
  notes: string | null;
  firstName: string | null;
  lastName: string | null;
  assignedTo: string | null;
  followUpDate: number | null;
}

function fmtDate(val: unknown): string {
  if (!val || isNaN(Number(val))) return '—';
  const n = Number(val);
  const ms = n > 1e10 ? n : n * 1000;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): LeadRow[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r as unknown as LeadRow;
  });
}

interface Props { refreshKey?: number; }

export default function LeadsBoard({ refreshKey = 0 }: Props) {
  const { hailer, inside, user } = useApp();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [rows, setRows]           = useState<LeadRow[]>([]);
  const [confMap, setConfMap]     = useState<Record<string, string>>({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [moving, setMoving]     = useState<string | null>(null);
  const [showDisqualified, setShowDisqualified] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [disqualifyNote, setDisqualifyNote] = useState('');

  const cardBg      = useColorModeValue('white', 'gray.700');
  const colBg       = useColorModeValue('gray.50', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const labelColor  = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_LEADS, { update: true }),
      hailer!.insight.data(INSIGHT_CONFERENCES, { update: true }),
    ]).then(([leadsData, confData]) => {
      setRows(parseInsight(leadsData));
      // Build conference ID → name map
      const map: Record<string, string> = {};
      confData.rows.forEach(row => {
        const id = row[0] as string;
        const name = row[1] as string;
        const code = row[2] as string;
        map[id] = code ? `${code} — ${name}` : name;
      });
      setConfMap(map);
      setLoading(false);
    }).catch(err => { setError(String(err)); setLoading(false); });
  }, [inside, refreshKey]);

  async function movePhase(lead: LeadRow, targetPhaseId: string, targetPhaseName: string) {
    setMoving(lead.id);
    try {
      await hailer!.activity.update([{ _id: lead.id, phaseId: targetPhaseId }], {});
      setRows(prev => prev.map(r => r.id === lead.id ? { ...r, phaseId: targetPhaseId, phase: targetPhaseName } : r));
      toast({ title: `Moved to ${targetPhaseName}`, status: 'success', duration: 2000, isClosable: true });
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 3000, isClosable: true });
    }
    setMoving(null);
  }

  async function disqualify(lead: LeadRow) {
    setMoving(lead.id);
    try {
      await hailer!.activity.update([{ _id: lead.id, phaseId: PHASE_DISQUALIFIED }], {});
      if (disqualifyNote) {
        const disc = await hailer!.activity.get(lead.id);
        if (disc?.discussion) {
          // Post note to discussion
        }
      }
      setRows(prev => prev.map(r => r.id === lead.id ? { ...r, phaseId: PHASE_DISQUALIFIED, phase: 'Disqualified' } : r));
      toast({ title: 'Lead Disqualified', status: 'warning', duration: 2000, isClosable: true });
      onClose();
      setDisqualifyNote('');
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 3000, isClosable: true });
    }
    setMoving(null);
  }

  function openDisqualify(lead: LeadRow) {
    setSelectedLead(lead);
    onOpen();
  }

  function userName(id: string | null): string {
    if (!id) return '—';
    const u = user.map[id];
    return u ? `${u.firstname} ${u.lastname}` : id;
  }

  const activeRows       = rows.filter(r => r.phaseId !== PHASE_DISQUALIFIED);
  const disqualifiedRows = rows.filter(r => r.phaseId === PHASE_DISQUALIFIED);

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;
  if (error)   return <Text color="red.500">Error: {error}</Text>;

  return (
    <Box>
      {/* Summary */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        {PHASES.map(p => (
          <Box key={p.id} p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
            borderTop="3px solid" borderTopColor={`${p.color}.400`}>
            <Stat>
              <StatLabel>{p.name}</StatLabel>
              <StatNumber>{activeRows.filter(r => r.phaseId === p.id).length}</StatNumber>
            </Stat>
          </Box>
        ))}
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
          borderTop="3px solid" borderTopColor="gray.400">
          <Stat>
            <StatLabel>Disqualified</StatLabel>
            <StatNumber>{disqualifiedRows.length}</StatNumber>
          </Stat>
        </Box>
      </SimpleGrid>

      {/* Kanban columns */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={6}>
        {PHASES.map(phase => {
          const phaseLeads = activeRows.filter(r => r.phaseId === phase.id);
          return (
            <Box key={phase.id} bg={colBg} borderRadius="md" border="1px" borderColor={borderColor} p={3}>
              <HStack mb={3} justify="space-between">
                <HStack>
                  <Badge colorScheme={phase.color}>{phase.name}</Badge>
                  <Text fontSize="sm" color={labelColor}>{phaseLeads.length}</Text>
                </HStack>
              </HStack>

              <VStack spacing={3} align="stretch">
                {phaseLeads.length === 0 && (
                  <Text fontSize="sm" color={labelColor} textAlign="center" py={4}>No leads</Text>
                )}
                {phaseLeads.map(lead => (
                  <Box key={lead.id} bg={cardBg} borderRadius="md" border="1px" borderColor={borderColor}
                    shadow="sm" p={3} cursor="pointer" onClick={() => hailer!.ui.activity.open(lead.id)}>

                    {/* Name */}
                    <Text fontWeight="bold" fontSize="sm" mb={1}>
                      {lead.firstName || lead.lastName ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : lead.name}
                    </Text>

                    {/* Company + email */}
                    {lead.company && <Text fontSize="xs" color={labelColor}>{lead.company}</Text>}
                    {lead.email && <Text fontSize="xs" color="blue.400">{lead.email}</Text>}

                    {/* Conference */}
                    {lead.conference && (
                      <HStack mt={1} spacing={1}>
                        <Text fontSize="xs">🎪</Text>
                        <Text fontSize="xs" fontWeight="medium">
                          {confMap[lead.conference] || lead.conference}
                        </Text>
                      </HStack>
                    )}

                    {/* Tags */}
                    {(lead.industry || lead.productFamily || lead.buyingStage) && (
                      <HStack mt={2} flexWrap="wrap" spacing={1}>
                        {lead.industry && <Badge fontSize="xs" colorScheme="gray">{lead.industry}</Badge>}
                        {lead.productFamily && <Badge fontSize="xs" colorScheme="teal">{lead.productFamily}</Badge>}
                        {lead.buyingStage && <Badge fontSize="xs" colorScheme="blue">{lead.buyingStage}</Badge>}
                      </HStack>
                    )}

                    {/* Notes */}
                    {lead.notes && (
                      <Text fontSize="xs" color={labelColor} mt={2} noOfLines={2}>{lead.notes}</Text>
                    )}

                    <Divider my={2} />

                    <HStack justify="space-between">
                      <Text fontSize="xs" color={labelColor}>{userName(lead.assignedTo)}</Text>
                      {lead.followUpDate && (
                        <Text fontSize="xs" color={labelColor}>↻ {fmtDate(lead.followUpDate)}</Text>
                      )}
                    </HStack>

                    {/* Phase action buttons */}
                    <HStack mt={3} spacing={2} onClick={e => e.stopPropagation()}>
                      {phase.id === PHASE_NEW_LEAD && (
                        <Button size="xs" colorScheme="purple" isLoading={moving === lead.id}
                          onClick={() => movePhase(lead, PHASE_CONTACTED, 'Contacted')}>
                          → Contacted
                        </Button>
                      )}
                      {phase.id === PHASE_CONTACTED && (
                        <Button size="xs" colorScheme="green" isLoading={moving === lead.id}
                          onClick={() => movePhase(lead, PHASE_QUALIFIED, 'Qualified')}>
                          → Qualified
                        </Button>
                      )}
                      {phase.id === PHASE_QUALIFIED && (
                        <Button size="xs" colorScheme="blue" isLoading={moving === lead.id}
                          onClick={() => movePhase(lead, PHASE_CONTACTED, 'Contacted')}>
                          ← Back
                        </Button>
                      )}
                      <Button size="xs" colorScheme="red" variant="outline" isLoading={moving === lead.id}
                        onClick={() => openDisqualify(lead)}>
                        Disqualify
                      </Button>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            </Box>
          );
        })}
      </SimpleGrid>

      {/* Disqualified toggle */}
      {disqualifiedRows.length > 0 && (
        <Box>
          <Button size="sm" variant="ghost" color={labelColor}
            onClick={() => setShowDisqualified(!showDisqualified)}>
            {showDisqualified ? '▲ Hide' : '▼ Show'} {disqualifiedRows.length} disqualified lead{disqualifiedRows.length !== 1 ? 's' : ''}
          </Button>

          {showDisqualified && (
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3} mt={3}>
              {disqualifiedRows.map(lead => (
                <Box key={lead.id} bg={cardBg} borderRadius="md" border="1px" borderColor={borderColor}
                  opacity={0.6} p={3}>
                  <Text fontWeight="medium" fontSize="sm">{lead.name}</Text>
                  {lead.company && <Text fontSize="xs" color={labelColor}>{lead.company}</Text>}
                  <Button size="xs" mt={2} variant="outline" isLoading={moving === lead.id}
                    onClick={() => movePhase(lead, PHASE_NEW_LEAD, 'New Lead')}>
                    Restore
                  </Button>
                </Box>
              ))}
            </SimpleGrid>
          )}
        </Box>
      )}

      {/* Disqualify modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Disqualify Lead</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>Are you sure you want to disqualify <strong>{selectedLead?.name}</strong>?</Text>
            <FormControl>
              <FormLabel fontSize="sm">Reason (optional)</FormLabel>
              <Textarea placeholder="Why is this lead being disqualified?"
                value={disqualifyNote} onChange={e => setDisqualifyNote(e.target.value)} rows={3} />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="red" isLoading={moving === selectedLead?.id}
              onClick={() => selectedLead && disqualify(selectedLead)}>
              Disqualify
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
