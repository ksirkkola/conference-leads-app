import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, FormControl, FormLabel, Heading, Input, Select, Spinner,
  Text, Textarea, useColorModeValue, useToast, VStack, Flex,
} from '@chakra-ui/react';
import { useApp } from './hailer/use-app';

// A simple, mobile-first lead-capture form — used on a phone at a conference booth to get
// leads into the system fast. No board, no list view, no login friction: fill it in, submit,
// it clears and is ready for the next person. Everything else (triage, follow-up, qualifying)
// happens later back at the office in the actual ConferenceLead workflow.

const WF_CONFERENCE_LEAD = '6a1940934aa20b6663634f4e';
const PHASE_NEW_LEAD = '6a1940934aa20b6663634f4d';

const F_FIRST_NAME = '6a1973c6e48a5ad6a5429e1a';
const F_LAST_NAME = '6a1973c6e48a5ad6a5429e1e';
const F_EMAIL = '6a1940f162ed800822c37c85';
const F_COMPANY = '6a1940f162ed800822c37c88';
const F_INDUSTRY = '6a1940f162ed800822c37c8c';
const F_PRODUCT_FAMILY = '6a1940f262ed800822c37c93';
const F_BUYING_STAGE = '6a1940f262ed800822c37c96';
const F_CONFERENCE = '6a1940f262ed800822c37c99';
const F_NOTES = '6a1940f262ed800822c37c9f';

const INSIGHT_CONFERENCE_LOOKUP = '6a69f2609653a6d4e49187d9';

const INDUSTRY_OPTIONS = [
  'Aerospace', 'Apparel', 'Education', 'Government', 'Healthcare', 'Mattress',
  'Military', 'Sports', 'TestLab', 'Textiles', 'Transportation', 'Other',
];
const BUYING_STAGE_OPTIONS = ['Awareness', 'Considering', 'Ready to Buy'];

interface ConferenceOption { id: string; name: string; code: string; }

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', company: '', industry: '',
  productFamily: '', buyingStage: '', conferenceId: '', notes: '',
};

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

export default function App() {
  const { hailer, api, inside, ready } = useApp();
  const toast = useToast();

  const [conferences, setConferences] = useState<ConferenceOption[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bg = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  useEffect(() => { void api.init(); }, [api]);

  useEffect(() => {
    if (!inside || !hailer) return;
    hailer.insight.data(INSIGHT_CONFERENCE_LOOKUP, { update: true })
      .then(data => {
        const opts = parseInsight(data).map(r => ({
          id: r.id as string, name: r.name as string, code: (r.conferenceCode as string) || '',
        }));
        opts.sort((a, b) => a.code.localeCompare(b.code));
        setConferences(opts);
      })
      .catch(err => console.error('Failed to load conferences:', err));
  }, [inside, hailer]);

  const conferenceOptions = useMemo(() => conferences, [conferences]);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function submitLead() {
    if (!form.firstName.trim() || !form.email.trim()) {
      toast({ title: 'First name and email are required', status: 'warning', duration: 3000 });
      return;
    }
    setSubmitting(true);
    try {
      let fileId: string | undefined;
      if (cardFile) {
        fileId = await hailer!.file.upload(cardFile, cardFile.name, {});
      }
      const fields: Record<string, string> = {
        [F_FIRST_NAME]: form.firstName.trim(),
        [F_EMAIL]: form.email.trim(),
      };
      if (form.lastName.trim()) fields[F_LAST_NAME] = form.lastName.trim();
      if (form.company.trim()) fields[F_COMPANY] = form.company.trim();
      if (form.industry) fields[F_INDUSTRY] = form.industry;
      if (form.productFamily.trim()) fields[F_PRODUCT_FAMILY] = form.productFamily.trim();
      if (form.buyingStage) fields[F_BUYING_STAGE] = form.buyingStage;
      if (form.conferenceId) fields[F_CONFERENCE] = form.conferenceId;
      if (form.notes.trim()) fields[F_NOTES] = form.notes.trim();

      await hailer!.activity.create(WF_CONFERENCE_LEAD, [{
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        phaseId: PHASE_NEW_LEAD,
        fields,
      }], fileId ? { fileIds: [fileId] } : {});

      toast({ title: 'Lead submitted!', status: 'success', duration: 2500 });
      setForm(EMPTY_FORM);
      setCardFile(null);
    } catch (err) {
      toast({ title: 'Could not submit lead', description: String(err), status: 'error', duration: 4000 });
    }
    setSubmitting(false);
  }

  if (!inside) return (
    <Flex h="100vh" align="center" justify="center">
      <Text color="gray.500">Open this app inside Hailer</Text>
    </Flex>
  );

  if (!ready) return (
    <Flex h="100vh" align="center" justify="center">
      <Spinner size="xl" />
    </Flex>
  );

  return (
    <Box minH="100vh" bg={bg} py={6} px={4}>
      <Box maxW="480px" mx="auto" bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={5} shadow="sm">
        <Heading size="md" mb={5}>New Conference Lead</Heading>

        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel fontSize="sm">First Name</FormLabel>
            <Input placeholder="First name" value={form.firstName} onChange={e => update('firstName', e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Last Name</FormLabel>
            <Input placeholder="Last name" value={form.lastName} onChange={e => update('lastName', e.target.value)} />
          </FormControl>

          <FormControl isRequired>
            <FormLabel fontSize="sm">Email</FormLabel>
            <Input type="email" placeholder="email@example.com" value={form.email} onChange={e => update('email', e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Company</FormLabel>
            <Input placeholder="Company name" value={form.company} onChange={e => update('company', e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Industry</FormLabel>
            <Select placeholder="Select industry" value={form.industry} onChange={e => update('industry', e.target.value)}>
              {INDUSTRY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Product Family</FormLabel>
            <Input placeholder="Product family" value={form.productFamily} onChange={e => update('productFamily', e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Buying Stage</FormLabel>
            <Select placeholder="Select stage" value={form.buyingStage} onChange={e => update('buyingStage', e.target.value)}>
              {BUYING_STAGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Conference</FormLabel>
            <Select placeholder="Select conference" value={form.conferenceId} onChange={e => update('conferenceId', e.target.value)}>
              {conferenceOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Notes</FormLabel>
            <Textarea placeholder="Notes..." rows={3} value={form.notes} onChange={e => update('notes', e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Business Card</FormLabel>
            <Input type="file" accept="image/*,application/pdf" p={1}
              onChange={e => setCardFile(e.target.files?.[0] || null)} />
          </FormControl>

          <Button colorScheme="blue" size="lg" isLoading={submitting} onClick={submitLead}>
            Submit Lead
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
