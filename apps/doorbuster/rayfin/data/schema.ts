import { AppMarker } from './AppMarker.js';
import { Approval } from './Approval.js';
import { Deal } from './Deal.js';
import { DealNote } from './DealNote.js';
import { DeskRole } from './DeskRole.js';
import { Person } from './Person.js';
import { SaleTick } from './SaleTick.js';

export type AppSchema = {
  Person: Person;
  AppMarker: AppMarker;
  Deal: Deal;
  SaleTick: SaleTick;
  DealNote: DealNote;
  Approval: Approval;
  DeskRole: DeskRole;
};

export const schema = [Person, AppMarker, Deal, SaleTick, DealNote, Approval, DeskRole];
